import Ajv2020 from "ajv/dist/2020.js";
import { canonicalJson, digestValue } from "../core/canonical.js";
import { assertSnapshot, lexical, projectGraph, requireCondition, requireJson, seal, traverseGraph } from "../stdlib/graph.js";
import { digestSchema, referenceSchema } from "../stdlib/schema.js";
import type { GraphSnapshot, GraphView } from "../stdlib/types.js";

export interface ClusterPolicy {
  id: string;
  keys: string[];
  max_groups: number;
  max_group_size: number;
  max_memberships: number;
  neighborhood?: { relation_types: string[]; now: string; max_depth: number };
}

export interface ClusterGroup {
  id: string;
  scope: string;
  key: string;
  value: string | number | boolean;
  member_ids: string[];
  evidence_refs: string[];
  reason: "metadata_match" | "metadata_and_dependencies" | "provider_proposal";
  revision_digest: string;
}

export interface ClusterProposal {
  contract_version: "1.0.0";
  base_digest: string;
  policy: ClusterPolicy;
  policy_digest: string;
  origin: "rules" | "provider";
  groups: ClusterGroup[];
  unassigned_ids: string[];
  overlapping_ids: string[];
  status: "proposed";
  canonical_write_allowed: false;
  provider_record?: { provider_id: string; input_digest: string; output_digest: string };
  digest: string;
}

const refs = { type: "array", uniqueItems: true, maxItems: 10000, items: referenceSchema };
export const CLUSTER_POLICY_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["id", "keys", "max_groups", "max_group_size", "max_memberships"],
  properties: { id: referenceSchema, keys: { ...refs, minItems: 1, maxItems: 16 },
    max_groups: { type: "integer", minimum: 1, maximum: 1000 },
    max_group_size: { type: "integer", minimum: 1, maximum: 10000 },
    max_memberships: { type: "integer", minimum: 1, maximum: 100000 },
    neighborhood: { type: "object", additionalProperties: false, required: ["relation_types", "now", "max_depth"],
      properties: { relation_types: { ...refs, minItems: 1, maxItems: 64 }, now: { type: "string", maxLength: 40 }, max_depth: { type: "integer", minimum: 1, maximum: 64 } } }
  }
};
const groupSchema = {
  type: "object", additionalProperties: false,
  required: ["id", "scope", "key", "value", "member_ids", "evidence_refs", "reason", "revision_digest"],
  properties: { id: referenceSchema, scope: referenceSchema, key: referenceSchema,
    value: { anyOf: [{ type: "string", maxLength: 256 }, { type: "number" }, { type: "boolean" }] },
    member_ids: { ...refs, minItems: 1 }, evidence_refs: refs,
    reason: { enum: ["metadata_match", "metadata_and_dependencies", "provider_proposal"] }, revision_digest: digestSchema }
};
export const CLUSTER_PROPOSAL_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://zabarov.github.io/mirai/schemas/cluster-proposal.schema.json",
  type: "object", additionalProperties: false,
  required: ["contract_version", "base_digest", "policy", "policy_digest", "origin", "groups", "unassigned_ids", "overlapping_ids", "status", "canonical_write_allowed", "digest"],
  properties: { contract_version: { const: "1.0.0" }, base_digest: digestSchema, policy: CLUSTER_POLICY_SCHEMA,
    policy_digest: digestSchema, origin: { enum: ["rules", "provider"] },
    groups: { type: "array", maxItems: 1000, items: groupSchema }, unassigned_ids: refs, overlapping_ids: refs,
    status: { const: "proposed" }, canonical_write_allowed: { const: false }, digest: digestSchema,
    provider_record: { type: "object", additionalProperties: false, required: ["provider_id", "input_digest", "output_digest"],
      properties: { provider_id: referenceSchema, input_digest: digestSchema, output_digest: digestSchema } }
  }
};

const ajv = new Ajv2020({ strict: false, allErrors: false });
const policyShape = ajv.compile<ClusterPolicy>(CLUSTER_POLICY_SCHEMA);
const proposalShape = ajv.compile<ClusterProposal>(CLUSTER_PROPOSAL_SCHEMA);
const providerShape = ajv.compile({ type: "object", additionalProperties: false, required: ["groups"], properties: {
  groups: { type: "array", maxItems: 1000, items: { type: "object", additionalProperties: false,
    required: ["scope", "key", "value", "member_ids"], properties: {
      scope: groupSchema.properties.scope, key: groupSchema.properties.key,
      value: groupSchema.properties.value, member_ids: groupSchema.properties.member_ids
    } } }
} });
export interface ProviderClusterOutput { groups: Array<Pick<ClusterGroup, "scope" | "key" | "value" | "member_ids">> }

function policyCopy(value: ClusterPolicy): ClusterPolicy {
  requireJson(value);
  requireCondition(policyShape(value), "cluster_policy_invalid");
  const result = structuredClone(value);
  result.keys.sort(lexical);
  if (result.neighborhood) {
    requireCondition(Number.isFinite(Date.parse(result.neighborhood.now)), "cluster_time_invalid");
    result.neighborhood.relation_types.sort(lexical);
  }
  return result;
}

function groupIdentity(policy: ClusterPolicy, group: Pick<ClusterGroup, "scope" | "key" | "value">): string {
  return `cluster.${digestValue([policy.id, group.scope, group.key, group.value]).slice(7)}`;
}

function makeGroup(graph: GraphSnapshot, policy: ClusterPolicy, input: Pick<ClusterGroup, "scope" | "key" | "value" | "member_ids">, reason: ClusterGroup["reason"]): ClusterGroup {
  const objects = new Map(graph.objects.map(o => [o.id, o]));
  requireCondition(policy.keys.includes(input.key), "cluster_key_not_allowed");
  requireCondition(input.member_ids.length > 0 && new Set(input.member_ids).size === input.member_ids.length, "cluster_duplicate_or_empty_members");
  requireCondition(input.member_ids.length <= policy.max_group_size, "cluster_group_budget_exceeded");
  requireCondition(input.member_ids.every(id => objects.get(id)?.scope === input.scope), "cluster_member_unknown_or_wrong_scope");
  const members = [...input.member_ids].sort(lexical);
  const refs = [...new Set(members.flatMap(id => objects.get(id)!.source_refs))].sort(lexical);
  const body = { id: groupIdentity(policy, input), scope: input.scope, key: input.key, value: input.value,
    member_ids: members, evidence_refs: refs, reason };
  return { ...body, revision_digest: digestValue(body) };
}

function proposalBody(graph: GraphSnapshot, policy: ClusterPolicy, groups: ClusterGroup[], origin: ClusterProposal["origin"], provider_record?: ClusterProposal["provider_record"]): ClusterProposal {
  requireCondition(groups.length <= policy.max_groups, "cluster_group_count_exceeded");
  requireCondition(new Set(groups.map(g => g.id)).size === groups.length, "cluster_duplicate_identity");
  const counts = new Map<string, number>();
  let total = 0;
  for (const group of groups) for (const id of group.member_ids) {
    counts.set(id, (counts.get(id) || 0) + 1);
    requireCondition(++total <= policy.max_memberships, "cluster_membership_budget_exceeded");
  }
  return seal({ contract_version: "1.0.0" as const, base_digest: graph.digest, policy,
    policy_digest: digestValue(policy), origin, groups: [...groups].sort((a, b) => lexical(a.id, b.id)),
    unassigned_ids: graph.objects.filter(o => !counts.has(o.id)).map(o => o.id).sort(lexical),
    overlapping_ids: [...counts].filter(([, n]) => n > 1).map(([id]) => id).sort(lexical),
    status: "proposed" as const, canonical_write_allowed: false as const, ...(provider_record ? { provider_record } : {}) });
}

export function proposeRuleClusters(graph: GraphSnapshot, options: ClusterPolicy): ClusterProposal {
  assertSnapshot(graph);
  const policy = policyCopy(options);
  const groups = new Map<string, Pick<ClusterGroup, "scope" | "key" | "value" | "member_ids">>();
  let assignments = 0;
  for (const object of graph.objects) for (const key of policy.keys) {
    const value = object.metadata[key];
    if (value === undefined) continue;
    for (const atom of Array.isArray(value) ? value : [value]) {
      const member = { scope: object.scope, key, value: atom, member_ids: [] as string[] };
      const id = groupIdentity(policy, member);
      const group = groups.get(id) || member;
      group.member_ids.push(object.id);
      groups.set(id, group);
      requireCondition(groups.size <= policy.max_groups && group.member_ids.length <= policy.max_group_size && ++assignments <= policy.max_memberships, "cluster_growth_budget_exceeded");
    }
  }
  const output: ClusterGroup[] = [];
  for (const group of groups.values()) {
    if (policy.neighborhood) {
      const scoped = projectGraph(graph, graph.objects.filter(o => o.scope === group.scope).map(o => o.id)).graph;
      group.member_ids = traverseGraph(scoped, { seeds: group.member_ids, direction: "both", scope: group.scope,
        now: policy.neighborhood.now, relation_types: policy.neighborhood.relation_types,
        max_depth: policy.neighborhood.max_depth, max_objects: policy.max_group_size, max_relations: 10000,
        max_visits: Math.max(1, Math.floor(1000000 / groups.size)) }).object_ids;
    }
    output.push(makeGroup(graph, policy, group, policy.neighborhood ? "metadata_and_dependencies" : "metadata_match"));
  }
  return proposalBody(graph, policy, output, "rules");
}

/** Pure validation/replay of a recorded response; this function never calls a model. */
export function importProviderClusters(graph: GraphSnapshot, options: ClusterPolicy, providerId: string, output: unknown): ClusterProposal {
  assertSnapshot(graph); requireJson(output);
  const policy = policyCopy(options);
  requireCondition(/^[A-Za-z][A-Za-z0-9_.:-]{0,159}$/.test(providerId), "cluster_provider_identity_invalid");
  requireCondition(providerShape(output), "cluster_provider_shape_invalid");
  const response = output as unknown as ProviderClusterOutput;
  requireCondition(response.groups.length <= policy.max_groups, "cluster_group_count_exceeded");
  const groups = response.groups.map(item => makeGroup(graph, policy, item, "provider_proposal"));
  return proposalBody(graph, policy, groups, "provider", { provider_id: providerId,
    input_digest: digestValue({ graph_digest: graph.digest, policy_digest: digestValue(policy) }), output_digest: digestValue(output) });
}

export function assertClusterProposal(graph: GraphSnapshot, value: unknown): asserts value is ClusterProposal {
  assertSnapshot(graph); requireJson(value);
  requireCondition(proposalShape(value), "cluster_proposal_shape_invalid");
  requireCondition(value.base_digest === graph.digest, "cluster_base_digest_mismatch");
  requireCondition(digestValue(value.policy) === value.policy_digest, "cluster_policy_digest_mismatch");
  const { digest, ...body } = value;
  requireCondition(digestValue(body) === digest, "cluster_proposal_digest_mismatch");
  if (value.origin === "rules") {
    requireCondition(!value.provider_record && proposeRuleClusters(graph, value.policy).digest === digest, "cluster_rule_result_mismatch");
  } else {
    requireCondition(value.provider_record && value.provider_record.input_digest === digestValue({ graph_digest: graph.digest, policy_digest: value.policy_digest }), "cluster_provider_record_mismatch");
    const expected = value.groups.map(group => makeGroup(graph, value.policy, group, "provider_proposal"));
    requireCondition(proposalBody(graph, value.policy, expected, "provider", value.provider_record).digest === digest, "cluster_membership_or_evidence_mismatch");
  }
}

export function evaluateClusters(graph: GraphSnapshot, proposal: ClusterProposal, expected?: Record<string, string[]>) {
  assertClusterProposal(graph, proposal);
  const actual = new Map(proposal.groups.map(g => [g.id, g.member_ids]));
  const missing: string[] = [];
  const unexpected: string[] = [];
  if (expected) {
    requireJson(expected);
    for (const [id, ids] of Object.entries(expected)) {
      requireCondition(Array.isArray(ids) && ids.every(x => typeof x === "string"), "cluster_oracle_invalid");
      for (const member of ids) if (!actual.get(id)?.includes(member)) missing.push(`${id}:${member}`);
    }
    for (const [id, ids] of actual) for (const member of ids) if (!expected[id]?.includes(member)) unexpected.push(`${id}:${member}`);
  }
  return seal({ base_digest: graph.digest, proposal_digest: proposal.digest,
    assigned_objects: graph.objects.length - proposal.unassigned_ids.length,
    unassigned_objects: proposal.unassigned_ids.length, overlapping_objects: proposal.overlapping_ids.length,
    total_memberships: proposal.groups.reduce((n, g) => n + g.member_ids.length, 0),
    missing: missing.sort(lexical), unexpected: unexpected.sort(lexical),
    oracle_checked: expected !== undefined, exact_oracle_match: expected ? missing.length === 0 && unexpected.length === 0 : null,
    correctness_proven: false, canonical_write_allowed: false });
}

export function materializeClusterView(graph: GraphSnapshot, proposal: ClusterProposal, groupId: string): GraphView {
  assertClusterProposal(graph, proposal);
  const group = proposal.groups.find(x => x.id === groupId);
  requireCondition(group, "unknown_cluster");
  return projectGraph(graph, group.member_ids);
}

export interface ClusterProposalProvider {
  id: string;
  propose(input: { graph: GraphSnapshot; policy: ClusterPolicy }, context: { signal: AbortSignal }): Promise<unknown>;
}

/** Trusted-host entrypoint, deliberately excluded from the pure operation catalog. */
export async function requestProviderClusters(graph: GraphSnapshot, options: ClusterPolicy, provider: ClusterProposalProvider,
  host: { timeout_ms: number; authorize: (request: { provider_id: string; input_digest: string }) => boolean }): Promise<{ proposal: ClusterProposal; recorded_output: unknown }> {
  assertSnapshot(graph);
  const policy = policyCopy(options);
  requireCondition(Number.isSafeInteger(host.timeout_ms) && host.timeout_ms > 0 && host.timeout_ms <= 60000, "cluster_provider_timeout_invalid");
  const inputDigest = digestValue({ graph_digest: graph.digest, policy_digest: digestValue(policy) });
  requireCondition(host.authorize({ provider_id: provider.id, input_digest: inputDigest }) === true, "cluster_inference_not_authorized");
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const output = await Promise.race([
      provider.propose(structuredClone({ graph, policy }), { signal: controller.signal }),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => { reject(new Error("cluster_provider_timeout")); controller.abort(); }, host.timeout_ms); })
    ]);
    return { proposal: importProviderClusters(graph, policy, provider.id, output), recorded_output: structuredClone(output) };
  } finally {
    if (timeout) clearTimeout(timeout);
    controller.abort();
  }
}
