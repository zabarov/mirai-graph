import { digestValue } from "../core/canonical.js";
import type { NormalizedUnit } from "../sources/types.js";
import {
  DEFAULT_KNOWLEDGE_BUDGETS,
  KNOWLEDGE_ASSERTION_CONTRACT_VERSION,
  KNOWLEDGE_PROPOSAL_CONTRACT_VERSION,
  type AliasRule,
  type IdentityResolution,
  type KnowledgeAssertion,
  type KnowledgeOrganizationInput,
  type KnowledgeProposal,
  type KnowledgeRelationFact
} from "./types.js";

function normalizeIdentity(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "") || "unnamed";
}

function unitLabel(unit: NormalizedUnit): string {
  if (typeof unit.content === "string") return unit.content.split(/\n/)[0]?.slice(0, 160) || unit.id;
  if (Array.isArray(unit.content)) return `${unit.source_ref} table`;
  const title = unit.content.title ?? unit.content.name ?? unit.content.label ?? unit.content.id;
  return typeof title === "string" ? title.slice(0, 160) : unit.source_ref;
}

function unitAssertions(unit: NormalizedUnit): KnowledgeAssertion[] {
  const label = unitLabel(unit);
  const baseIdentity = normalizeIdentity(label);
  const entries: Array<[string, unknown]> = unit.content && typeof unit.content === "object" && !Array.isArray(unit.content)
    ? Object.entries(unit.content)
    : [[unit.kind === "table" ? "rows" : "content", unit.content]];
  return entries.map(([predicate, value], index) => {
    const valueDigest = digestValue(value);
    const identityKey = `${unit.scope}:${baseIdentity}`;
    return {
      contract_version: KNOWLEDGE_ASSERTION_CONTRACT_VERSION,
      id: `assertion.${digestValue({ identityKey, predicate, valueDigest, source: unit.source_ref }).slice(7, 23)}.${index + 1}`,
      identity_key: identityKey,
      semantic_type: unit.kind === "table" ? "source_table" : unit.kind === "record" ? "source_record" : "source_concept",
      label,
      predicate,
      value,
      value_digest: valueDigest,
      scope: unit.scope,
      confidentiality: unit.confidentiality,
      quality: {
        extraction_confidence: 1,
        source_authority: unit.authority,
        corroboration_count: 1,
        freshness: "unknown",
        conflict_state: "none"
      },
      provenance: [{ source_ref: unit.source_ref, source_fingerprint: unit.source_fingerprint, content_digest: unit.content_digest }],
      lifecycle: "candidate",
      source_state: "available",
      authority_decision_required: false,
      canonical_write_allowed: false
    };
  });
}

function unitAssertionCount(unit: NormalizedUnit): number {
  return unit.content && typeof unit.content === "object" && !Array.isArray(unit.content)
    ? Object.keys(unit.content).length
    : 1;
}

function budgetProposal(
  budgets: KnowledgeProposal["budgets"],
  code: string,
  message: string,
  dimension: NonNullable<KnowledgeProposal["growth_control"]>["dimension"],
  observed: number,
  limit: number
): KnowledgeProposal {
  const candidate = {
    contract_version: KNOWLEDGE_PROPOSAL_CONTRACT_VERSION,
    assertions: [], identity_resolutions: [], exact_duplicate_groups: [], conflicts: [], relation_facts: [], stale_assertion_ids: [],
    diagnostics: [{ code, severity: "blocking" as const, message }],
    quality: { provenance_coverage: 1, conflict_count: 0, ambiguous_identity_count: 0, proposal_noise_ratio: 1, readiness: "blocked" as const },
    budgets,
    growth_control: {
      status: "partitioning_required" as const,
      dimension,
      observed,
      limit,
      suggested_actions: ["partition_by_source_scope", "partition_by_fingerprint_prefix", "review_exact_duplicates", "review_stale_and_superseded"] as const,
      automatic_pruning_allowed: false as const,
      proposal_only: true as const
    },
    canonical_write_allowed: false as const,
    next_safe_action: "partition_source" as const
  };
  return { ...candidate, growth_control: { ...candidate.growth_control, suggested_actions: [...candidate.growth_control.suggested_actions] }, digest: digestValue(candidate) };
}

function resolveIdentity(identity: string, scope: string, aliases: AliasRule[], known: Set<string>): IdentityResolution {
  if (known.has(identity)) return { candidate_identity: identity, resolution: "exact", canonical_identity: identity, candidate_matches: [identity], owner_review_required: false };
  const alias = aliases.find((item) => item.reviewed && item.scope === scope && normalizeIdentity(item.alias) === identity.split(":").at(-1));
  if (alias) return { candidate_identity: identity, resolution: "reviewed_alias", canonical_identity: alias.canonical_identity, candidate_matches: [alias.canonical_identity], owner_review_required: false };
  const suffix = identity.split(":").at(-1) as string;
  const matches = [...known].filter((item) => item.endsWith(`:${suffix}`)).sort();
  if (matches.length > 1) return { candidate_identity: identity, resolution: "ambiguous", candidate_matches: matches, owner_review_required: true };
  return { candidate_identity: identity, resolution: "new_identity", canonical_identity: identity, candidate_matches: [], owner_review_required: false };
}

function relationFacts(assertions: KnowledgeAssertion[]): KnowledgeRelationFact[] {
  const facts: KnowledgeRelationFact[] = [];
  for (const assertion of assertions) {
    if (!/(?:_ref|_id|owner|depends_on|requires|uses)$/i.test(assertion.predicate)) continue;
    const values = Array.isArray(assertion.value) ? assertion.value : [assertion.value];
    for (const value of values) {
      if (typeof value !== "string" || !value.trim()) continue;
      const target = `${assertion.scope}:${normalizeIdentity(value)}`;
      facts.push({
        id: `relation.${digestValue({ source: assertion.identity_key, predicate: assertion.predicate, target }).slice(7, 23)}`,
        type: assertion.predicate,
        participants: [{ ref: assertion.identity_key, role: "source" }, { ref: target, role: "target" }],
        qualifiers: {},
        scope: assertion.scope,
        authority: assertion.quality.source_authority,
        confidence: assertion.quality.extraction_confidence,
        provenance: assertion.provenance.map((item) => ({ source_ref: item.source_ref })),
        lifecycle: "candidate"
      });
    }
  }
  return facts.sort((a, b) => a.id.localeCompare(b.id));
}

export function organizeKnowledge(input: KnowledgeOrganizationInput): KnowledgeProposal {
  const budgets = { ...DEFAULT_KNOWLEDGE_BUDGETS, ...(input.budgets || {}) };
  if (input.units.length > budgets.max_units) {
    return budgetProposal(budgets, "knowledge_unit_budget_exceeded", "The normalization scope exceeds the configured unit budget.", "units", input.units.length, budgets.max_units);
  }
  const estimatedAssertions = input.units.reduce((sum, unit) => sum + unitAssertionCount(unit), 0);
  if (estimatedAssertions > budgets.max_assertions) {
    return budgetProposal(budgets, "knowledge_assertion_budget_exceeded", "The projected assertion count exceeds the configured graph-growth budget.", "assertions", estimatedAssertions, budgets.max_assertions);
  }
  const assertions = input.units.flatMap(unitAssertions);
  const aliases = input.aliases || [];
  const known = new Set([...(input.known_identities || []), ...(input.previous_assertions || []).map((item) => item.identity_key)]);
  const identityResolutions = [...new Set(assertions.map((item) => item.identity_key))].sort().map((identity) => {
    const scope = identity.split(":")[0] as string;
    return resolveIdentity(identity, scope, aliases, known);
  });
  const resolutionMap = new Map(identityResolutions.map((item) => [item.candidate_identity, item]));
  for (const assertion of assertions) {
    const resolution = resolutionMap.get(assertion.identity_key);
    if (resolution?.canonical_identity) assertion.identity_key = resolution.canonical_identity;
    if (resolution?.owner_review_required) {
      assertion.quality.conflict_state = "ambiguous_identity";
      assertion.authority_decision_required = true;
    }
  }
  const byValue = new Map<string, KnowledgeAssertion[]>();
  const byFact = new Map<string, KnowledgeAssertion[]>();
  for (const assertion of assertions) {
    const duplicateKey = `${assertion.identity_key}:${assertion.predicate}:${assertion.value_digest}`;
    byValue.set(duplicateKey, [...(byValue.get(duplicateKey) || []), assertion]);
    const factKey = `${assertion.identity_key}:${assertion.predicate}`;
    byFact.set(factKey, [...(byFact.get(factKey) || []), assertion]);
  }
  const duplicateGroups = [...byValue.values()].filter((items) => items.length > 1).map((items) => {
    items.forEach((item) => { item.quality.conflict_state = "duplicate"; item.quality.corroboration_count = items.length; });
    return { value_digest: items[0]?.value_digest as string, assertion_ids: items.map((item) => item.id).sort() };
  }).sort((a, b) => a.value_digest.localeCompare(b.value_digest));
  const conflictEntries = [...byFact.entries()].filter(([, items]) => new Set(items.map((item) => item.value_digest)).size > 1);
  if (conflictEntries.length > budgets.max_conflicts) {
    return budgetProposal(budgets, "knowledge_conflict_budget_exceeded", "The conflict-family count exceeds the configured review budget.", "conflicts", conflictEntries.length, budgets.max_conflicts);
  }
  const conflicts = conflictEntries.map(([key, items]) => {
    items.forEach((item) => { item.quality.conflict_state = "conflicting"; item.authority_decision_required = true; });
    const separator = key.lastIndexOf(":");
    return {
      id: `conflict.${digestValue(key).slice(7, 23)}`,
      identity_key: key.slice(0, separator),
      predicate: key.slice(separator + 1),
      assertion_ids: items.map((item) => item.id).sort(),
      value_digests: [...new Set(items.map((item) => item.value_digest))].sort(),
      resolution: "owner_review_required" as const
    };
  }).sort((a, b) => a.id.localeCompare(b.id));
  const activeSourceRefs = new Set(assertions.flatMap((item) => item.provenance.map((entry) => entry.source_ref)));
  const stale = (input.previous_assertions || []).filter((item) => item.provenance.every((entry) => !activeSourceRefs.has(entry.source_ref))).map((item) => item.id).sort();
  const relationEstimate = assertions.reduce((sum, assertion) => {
    if (!/(?:_ref|_id|owner|depends_on|requires|uses)$/i.test(assertion.predicate)) return sum;
    const values = Array.isArray(assertion.value) ? assertion.value : [assertion.value];
    return sum + values.filter((value) => typeof value === "string" && value.trim()).length;
  }, 0);
  if (relationEstimate > budgets.max_relations) {
    return budgetProposal(budgets, "knowledge_relation_budget_exceeded", "The relation-fact count exceeds the configured graph-growth budget.", "relations", relationEstimate, budgets.max_relations);
  }
  const relations = relationFacts(assertions);
  const ambiguous = identityResolutions.filter((item) => item.owner_review_required).length;
  const diagnostics: KnowledgeProposal["diagnostics"] = [];
  if (conflicts.length) diagnostics.push({ code: "knowledge_conflicts_require_review", severity: "blocking", message: `${conflicts.length} conflict families require an owner decision.`, assertion_refs: conflicts.flatMap((item) => item.assertion_ids) });
  if (ambiguous) diagnostics.push({ code: "ambiguous_identity_requires_review", severity: "blocking", message: `${ambiguous} identities have multiple candidates.` });
  if (stale.length) diagnostics.push({ code: "source_missing_assertions_stale", severity: "warning", message: `${stale.length} prior assertions lost all current source references.`, assertion_refs: stale });
  const blocked = conflicts.length > 0 || ambiguous > 0;
  const candidate = {
    contract_version: KNOWLEDGE_PROPOSAL_CONTRACT_VERSION,
    assertions: assertions.sort((a, b) => a.id.localeCompare(b.id)),
    identity_resolutions: identityResolutions,
    exact_duplicate_groups: duplicateGroups,
    conflicts,
    relation_facts: relations,
    stale_assertion_ids: stale,
    diagnostics,
    quality: {
      provenance_coverage: assertions.length ? assertions.filter((item) => item.provenance.length > 0).length / assertions.length : 1,
      conflict_count: conflicts.length,
      ambiguous_identity_count: ambiguous,
      proposal_noise_ratio: assertions.length ? (conflicts.reduce((sum, item) => sum + item.assertion_ids.length, 0) + ambiguous) / assertions.length : 0,
      readiness: blocked ? "blocked" as const : "ready_for_review" as const
    },
    budgets,
    canonical_write_allowed: false as const,
    next_safe_action: conflicts.length ? "resolve_conflicts" as const : "owner_review" as const
  };
  return { ...candidate, digest: digestValue(candidate) };
}
