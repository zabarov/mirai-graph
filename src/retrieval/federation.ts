import { digestValue } from "../core/index.js";
import type {
  FederatedQueryEnvelope,
  FederatedQueryResult,
  FederatedRetrievalDirectoryEntry,
  RetrievalFreshness
} from "./types.js";

export type FederatedRetrievalHandler = (envelope: FederatedQueryEnvelope, entry: FederatedRetrievalDirectoryEntry) => Promise<FederatedQueryResult>;

interface CachedFederatedResult {
  graph_id: string;
  expires_at: number;
  result: FederatedQueryResult;
}

function cacheKey(entry: FederatedRetrievalDirectoryEntry, envelope: FederatedQueryEnvelope): string | undefined {
  if (!entry.index_digest) return undefined;
  return digestValue({
    envelope,
    responder_graph_id: entry.graph_id,
    index_digest: entry.index_digest,
    graph_digest: entry.graph_digest ?? null,
    policy_digest: entry.policy_digest
  });
}

export class FederatedRetrievalCache {
  private readonly entries = new Map<string, CachedFederatedResult>();

  get(entry: FederatedRetrievalDirectoryEntry, envelope: FederatedQueryEnvelope, now = Date.now()): FederatedQueryResult | undefined {
    const key = cacheKey(entry, envelope);
    if (!key) return undefined;
    const cached = this.entries.get(key);
    if (!cached || cached.expires_at <= now) {
      if (cached) this.entries.delete(key);
      return undefined;
    }
    return structuredClone(cached.result);
  }

  set(entry: FederatedRetrievalDirectoryEntry, envelope: FederatedQueryEnvelope, result: FederatedQueryResult, now = Date.now()): void {
    const key = cacheKey(entry, envelope);
    if (!key || result.status !== "complete" || result.index_digest !== entry.index_digest || result.graph_digest !== (entry.graph_digest ?? null)) return;
    const ttl = Math.min(Math.max(entry.cache_ttl_ms ?? 30_000, 1), 3_600_000);
    this.entries.set(key, { graph_id: entry.graph_id, expires_at: Math.min(now + ttl, Date.parse(envelope.deadline)), result: structuredClone(result) });
  }

  invalidateGraph(graphId: string): number {
    let removed = 0;
    for (const [key, value] of this.entries) if (value.graph_id === graphId) {
      this.entries.delete(key);
      removed += 1;
    }
    return removed;
  }
}

async function callBeforeDeadline(handler: FederatedRetrievalHandler, envelope: FederatedQueryEnvelope, entry: FederatedRetrievalDirectoryEntry): Promise<FederatedQueryResult> {
  const remaining = Date.parse(envelope.deadline) - Date.now();
  if (remaining <= 0) throw new Error("federated_deadline_expired");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      handler(envelope, entry),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("federated_remote_timeout")), Math.min(remaining, 2_147_483_647)); })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function freshnessRank(value: RetrievalFreshness): number {
  return { stale: 0, unknown: 1, aging: 2, current: 3 }[value];
}

function requiredFreshness(value: FederatedQueryEnvelope["freshness_required"]): number {
  return value === "allow_stale" ? 0 : value === "allow_aging" ? 2 : 3;
}

export function validateFederatedEnvelope(envelope: FederatedQueryEnvelope, now = new Date()): string[] {
  const errors: string[] = [];
  if (envelope.contract_version !== "1.0.0") errors.push("federated_contract_version_unsupported");
  if (!envelope.id || !envelope.origin_graph_id || !envelope.query.trim()) errors.push("federated_identity_or_query_required");
  if (envelope.canonical_write_allowed !== false) errors.push("federated_canonical_write_must_be_false");
  if (envelope.max_hops < 1 || envelope.max_hops > 16) errors.push("federated_hop_budget_invalid");
  if (envelope.max_fan_out < 1 || envelope.max_fan_out > 64) errors.push("federated_fan_out_budget_invalid");
  if (envelope.visited_graph_ids.length > envelope.max_hops) errors.push("federated_hop_budget_exhausted");
  if (new Set(envelope.visited_graph_ids).size !== envelope.visited_graph_ids.length) errors.push("federated_route_cycle_detected");
  if (!Number.isFinite(Date.parse(envelope.deadline)) || Date.parse(envelope.deadline) <= now.getTime()) errors.push("federated_deadline_expired");
  if (envelope.token_budget < 0 || envelope.cost_budget < 0) errors.push("federated_cost_budget_invalid");
  return [...new Set(errors)].sort();
}

export function selectFederatedTargets(directory: FederatedRetrievalDirectoryEntry[], envelope: FederatedQueryEnvelope): FederatedRetrievalDirectoryEntry[] {
  const errors = validateFederatedEnvelope(envelope);
  if (errors.length) throw new Error(errors.join(","));
  if (new Set(directory.map((entry) => entry.graph_id)).size !== directory.length) throw new Error("federated_directory_duplicate_graph_id");
  if (envelope.visited_graph_ids.length >= envelope.max_hops) throw new Error("federated_hop_budget_exhausted");
  const targets = directory.filter((entry) =>
    !envelope.visited_graph_ids.includes(entry.graph_id)
    && entry.graph_id !== envelope.origin_graph_id
    && entry.intents.includes(envelope.intent)
    && entry.domains.some((domain) => envelope.target_domains.includes(domain))
    && entry.scopes.some((scope) => envelope.requester.scopes.includes(scope))
    && freshnessRank(entry.freshness) >= requiredFreshness(envelope.freshness_required)
  ).sort((a, b) => b.authority.localeCompare(a.authority) || a.graph_id.localeCompare(b.graph_id));
  return targets.slice(0, envelope.max_fan_out);
}

export async function dispatchFederatedQuery(
  directory: FederatedRetrievalDirectoryEntry[],
  envelope: FederatedQueryEnvelope,
  handlers: Record<string, FederatedRetrievalHandler>,
  options: { cache?: FederatedRetrievalCache } = {}
): Promise<{ results: FederatedQueryResult[]; blockers: string[]; partial: boolean; digest: string }> {
  const targets = selectFederatedTargets(directory, envelope);
  const blockers: string[] = [];
  const settled = await Promise.all(targets.map(async (entry): Promise<FederatedQueryResult | null> => {
    const handler = handlers[entry.endpoint_alias];
    if (!handler) {
      blockers.push(`federated_endpoint_unavailable:${entry.endpoint_alias}`);
      return null;
    }
    try {
      const forwarded = { ...envelope, visited_graph_ids: [...envelope.visited_graph_ids, envelope.origin_graph_id] };
      const cached = options.cache?.get(entry, forwarded);
      const result = cached || await callBeforeDeadline(handler, forwarded, entry);
      const { digest, ...body } = result;
      if (result.query_id !== envelope.id || result.responder_graph_id !== entry.graph_id || result.policy_digest !== entry.policy_digest) throw new Error("federated_result_binding_mismatch");
      if (result.instructions_authorized !== false || result.canonical_write_allowed !== false || result.evidence_bundle.instructions_authorized !== false) throw new Error("federated_result_authority_boundary_broken");
      if (result.query_digest !== digestValue(forwarded) || result.evidence_bundle.query_digest !== result.query_digest || result.evidence_bundle.policy_digest !== result.policy_digest) throw new Error("federated_result_query_or_evidence_mismatch");
      if (result.evidence_bundle.index_digest !== result.index_digest || result.evidence_bundle.graph_digest !== result.graph_digest) throw new Error("federated_result_snapshot_mismatch");
      if (digestValue(body) !== digest) throw new Error("federated_result_digest_mismatch");
      if (!cached) options.cache?.set(entry, forwarded, result);
      return result;
    } catch (error) {
      blockers.push(`federated_query_failed:${entry.graph_id}:${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }));
  const results = settled.filter((item): item is FederatedQueryResult => Boolean(item));
  const body = { query_digest: digestValue(envelope), result_digests: results.map((item) => item.digest).sort(), blockers: [...new Set(blockers)].sort(), partial: blockers.length > 0 || results.length < targets.length, canonical_write_allowed: false as const };
  return { results, blockers: body.blockers, partial: body.partial, digest: digestValue(body) };
}
