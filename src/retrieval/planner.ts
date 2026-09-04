import { digestValue } from "../core/index.js";
import { assertSnapshot } from "../stdlib/graph.js";
import type { EvidenceBundle, RetrievalAnswer, RetrievalChannel, RetrievalHit, RetrievalIndexDescriptor, RetrievalIntent, RetrievalProjectConfig, RetrievalRequest, RetrievalPlan } from "./types.js";

const INTENT_TERMS: Array<[RetrievalIntent, RegExp]> = [
  ["change_or_freshness", /(актуал|последн|измен|устар|текущ|конфликт|current|latest|changed|stale|superseded|conflict)/iu],
  ["relationship_trace", /(связ|завис|влияет|путь|владел|маршрут|иерарх|делегир|relation|depend|impact|path|owner|owns|owned|routing|hierarchy|delegat)/iu],
  ["technology_lookup", /(технолог|процесс|инструк|процедур|сценари|последовательност|program|process|workflow|procedure|scenario|how\s+(?:to|may|does|can))/iu],
  ["policy_lookup", /(правил|политик|разреш|запрещ|согласован|полномоч|кворум|безопасност|шлюз|policy|permission|allowed|forbidden|approval|authority|quorum|safety|gate|capability)/iu],
  ["evidence_lookup", /(доказ|подтверж|провер|тест|аудит|замечан|урок|результат|evidence|proof|receipt|result|test|review|audit|finding|lesson)/iu],
  ["global_synthesis", /(обзор|сравн|общая\s+картина|overall|overview|compare|across)/iu]
];

const EXACT_SEMANTIC_TERMS = /(каноническ|точн(?:ое|ый|ая|ые)?\s+(?:имя|название|значение|техническ)|specific(?:ation)?|exact\s+(?:name|value|document))/iu;

export function inferRetrievalIntent(query: string): { intent: RetrievalIntent; confidence: number; alternatives: RetrievalIntent[] } {
  const trimmed = query.trim();
  const exactIdentifier = /^(?:"[^"\n]+"|`[^`\n]+`|[A-Za-z][A-Za-z0-9]*(?:[_.:][A-Za-z0-9-]+)+|[A-Za-z]+[0-9][A-Za-z0-9-]*)$/u.test(trimmed);
  const matches = INTENT_TERMS.filter(([, pattern]) => pattern.test(query)).map(([intent]) => intent);
  if (exactIdentifier || EXACT_SEMANTIC_TERMS.test(query)) return { intent: "exact_lookup", confidence: 0.9, alternatives: ["semantic_discovery"] };
  if (matches.includes("change_or_freshness")) return { intent: "change_or_freshness", confidence: 0.88, alternatives: matches.filter((item) => item !== "change_or_freshness") };
  if (matches.length === 1) return { intent: matches[0] as RetrievalIntent, confidence: 0.84, alternatives: ["semantic_discovery"] };
  if (matches.length > 1) return { intent: matches[0] as RetrievalIntent, confidence: 0.62, alternatives: matches.slice(1) };
  return { intent: "semantic_discovery", confidence: 0.7, alternatives: ["exact_lookup"] };
}

export function planRetrieval(request: RetrievalRequest, descriptor: RetrievalIndexDescriptor, config: RetrievalProjectConfig): RetrievalPlan {
  if (request.contract_version !== "1.0.0" || request.canonical_write_allowed !== false || !request.id) throw new Error("retrieval_request_contract_invalid");
  if (!request.query.trim() || request.query.length > 4096) throw new Error("retrieval_query_invalid");
  if (!request.access || typeof request.access !== "object" || !request.access.principal_id || !request.access.purpose || !request.access.policy_digest) throw new Error("retrieval_access_invalid");
  for (const values of [request.access.scopes, request.access.source_refs, request.access.document_ids]) {
    if (values !== undefined && (!Array.isArray(values) || values.length === 0 || values.some((item) => typeof item !== "string" || item.length === 0) || new Set(values).size !== values.length)) throw new Error("retrieval_access_invalid");
  }
  if (request.max_results !== undefined && (!Number.isSafeInteger(request.max_results) || request.max_results < 1)) throw new Error("retrieval_max_results_invalid");
  if (request.graph !== undefined) assertSnapshot(request.graph);
  if (/(?:BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|\b(?:ghp_|sk-proj-|xoxb-)[A-Za-z0-9_-]{8,}|\/Users\/|[A-Za-z]:\\Users\\)/u.test(request.query)) throw new Error("retrieval_sensitive_query_rejected");
  if (digestValue(request.access) !== descriptor.access_digest) throw new Error("retrieval_access_projection_mismatch");
  const inferred = request.intent ? { intent: request.intent, confidence: 1, alternatives: [] as RetrievalIntent[] } : inferRetrievalIntent(request.query);
  const defaults: RetrievalChannel[] = inferred.intent === "exact_lookup" ? ["exact", "lexical"]
    : inferred.intent === "relationship_trace" ? ["lexical", "semantic", "graph"]
      : ["technology_lookup", "policy_lookup", "evidence_lookup"].includes(inferred.intent) ? ["exact", "lexical", "semantic", "graph", "process"]
        : inferred.intent === "global_synthesis" ? ["exact", "lexical", "semantic", "graph", "process"]
          : ["exact", "lexical", "semantic", "graph"];
  const requested = request.channels || defaults;
  const known = new Set<RetrievalChannel>(["exact", "lexical", "semantic", "graph", "process"]);
  if (!requested.length || requested.some((item) => !known.has(item))) throw new Error("retrieval_channel_invalid");
  const channels = [...new Set(requested)].filter((item) => item !== "semantic" || descriptor.semantic_status === "ready");
  const diagnostics: string[] = [];
  if (requested.includes("semantic") && descriptor.semantic_status !== "ready") diagnostics.push(`semantic_${descriptor.semantic_status}`);
  if (inferred.confidence < 0.65) diagnostics.push(`intent_ambiguous:${inferred.alternatives.join(",")}`);
  const body = {
    contract_version: "1.0.0" as const,
    request_digest: digestValue(request),
    intent: inferred.intent,
    channels,
    filters: {
      scopes: [...request.access.scopes].sort(),
      source_refs: [...request.access.source_refs].sort(),
      freshness_required: request.freshness_required || "current" as const
    },
    budgets: {
      max_results: Math.min(request.max_results || config.budgets.max_query_results, config.budgets.max_query_results),
      max_graph_depth: config.budgets.max_graph_depth,
      max_fan_out: config.budgets.max_fan_out,
      max_hops: config.budgets.max_hops,
      timeout_ms: config.budgets.timeout_ms
    },
    semantic_status: descriptor.semantic_status,
    diagnostics,
    canonical_write_allowed: false as const
  };
  return { ...body, digest: digestValue(body) };
}

export function reciprocalRankFusion(rankings: Array<{ channel: RetrievalChannel; ids: string[] }>, constant = 60): Map<string, { score: number; channels: RetrievalChannel[] }> {
  const fused = new Map<string, { score: number; channels: RetrievalChannel[] }>();
  for (const ranking of rankings) ranking.ids.forEach((id, index) => {
    const current = fused.get(id) || { score: 0, channels: [] };
    current.score += 1 / (constant + index + 1);
    if (!current.channels.includes(ranking.channel)) current.channels.push(ranking.channel);
    fused.set(id, current);
  });
  return fused;
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export function createRetrievalAnswer(request: RetrievalRequest, plan: RetrievalPlan, evidence: EvidenceBundle): RetrievalAnswer {
  const ambiguous = plan.diagnostics.some((item) => item.startsWith("intent_ambiguous"));
  const status: RetrievalAnswer["status"] = ambiguous ? "clarification_required" : evidence.hits.length === 0 ? "insufficient_evidence" : evidence.partial ? "partial" : "answered";
  const claims = status === "clarification_required" ? [] : evidence.hits.map((hit) => ({
    text: hit.snippet ? `${hit.title}: ${hit.snippet}` : `${hit.title} is available at ${hit.source_ref}.`,
    evidence_refs: unique(hit.evidence_refs.length ? hit.evidence_refs : [hit.source_ref]),
    source_refs: [hit.source_ref]
  }));
  const selectedProgramHit = evidence.hits.find((hit) => hit.program_refs.length > 0);
  const selectedPolicyHit = evidence.hits.find((hit) => hit.policy_refs.length > 0);
  const body = {
    contract_version: "1.0.0" as const,
    request_id: request.id,
    intent: plan.intent,
    status,
    answer: status === "clarification_required" ? "The request has multiple materially different interpretations; clarify the intended outcome before relying on retrieval."
      : status === "insufficient_evidence" ? "No authorized, sufficiently fresh evidence was found."
        : claims.map((claim) => claim.text).join("\n"),
    claims,
    relevant_relationships: evidence.hits.filter((hit) => hit.graph_path).map((hit) => ({ path: hit.graph_path as string[], evidence_refs: unique(hit.evidence_refs.length ? hit.evidence_refs : [hit.source_ref]) })),
    program_candidates: unique(selectedProgramHit?.program_refs || []),
    policy_refs: unique(selectedPolicyHit?.policy_refs || []),
    conflicts: evidence.conflicts,
    limitations: evidence.limitations,
    next_safe_action: status === "clarification_required" ? "clarify_intent" : status === "insufficient_evidence" ? "expand_authorized_sources_or_review_freshness" : "review_evidence_before_action",
    execution_allowed: false as const,
    content_is_untrusted_data: true as const,
    canonical_write_allowed: false as const,
    evidence_bundle_digest: evidence.digest
  };
  return { ...body, digest: digestValue(body) };
}

export function sortHits(hits: RetrievalHit[]): RetrievalHit[] {
  const authority = new Map<string, number>([["canonical_external", 5], ["canonical", 5], ["owner_asserted", 4], ["supporting", 3], ["informational", 2], ["derived", 1], ["proposal", 0]]);
  const freshness = new Map<string, number>([["current", 3], ["aging", 2], ["unknown", 1], ["stale", 0]]);
  return hits.sort((a, b) => (b.rank_score - a.rank_score) || ((authority.get(b.authority) || 0) - (authority.get(a.authority) || 0)) || ((freshness.get(b.freshness) || 0) - (freshness.get(a.freshness) || 0)) || a.document_id.localeCompare(b.document_id));
}
