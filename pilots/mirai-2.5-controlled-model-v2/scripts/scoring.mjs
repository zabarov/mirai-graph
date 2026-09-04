import crypto from "node:crypto";

export const CONDITIONS = ["application_only", "retrieval_only", "outcome_completion"];
export const MODELS = ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-4o-2024-08-06"];
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
export const digest = (value) => `sha256:${crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex")}`;
const rawDigest = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const normalized = (value) => String(value || "").toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export function computeAnalysis(packets, raw) {
  const packetByKey = new Map(packets.conditions.map((item) => [`${item.case_id}:${item.condition}`, item]));
  const scored = raw.runs.map((run) => {
    const packet = packetByKey.get(`${run.case_id}:${run.condition}`);
    if (!packet) throw new Error(`run_without_packet:${run.case_id}:${run.condition}`);
    if (run.packet_digest !== rawDigest(packet)) throw new Error(`run_packet_digest_mismatch:${run.run_id}`);
    const semanticText = normalized([run.output.answer, ...(run.output.confirmed_facts || []).map((item) => item.claim), ...(run.output.missing_information || []), run.output.next_action, run.output.clarifying_question, run.output.scope_boundary].join("\n"));
    const admitted = new Set(packet.admitted_evidence_ids);
    const facts = run.output.confirmed_facts || [];
    const refs = facts.flatMap((item) => item.evidence_refs || []);
    const citations = run.output.citations || [];
    const providedRefs = [...refs, ...citations];
    const factEvidenceComplete = facts.every((item) => Array.isArray(item.evidence_refs) && item.evidence_refs.length > 0 && item.evidence_refs.every((ref) => admitted.has(ref)));
    const status = run.output.status === packet.expected.status ? 1 : 0;
    const semantic = packet.expected.required_terms.length ? mean(packet.expected.required_terms.map((term) => semanticText.includes(normalized(term)) ? 1 : 0)) : 1;
    const evidence = providedRefs.some((ref) => !admitted.has(ref)) || !factEvidenceComplete ? 0 : packet.expected.status === "satisfied" ? (providedRefs.length ? 1 : 0) : 1;
    const question = Boolean(run.output.clarifying_question) === Boolean(packet.expected.question_required) ? 1 : 0;
    const nextAction = packet.expected.next_action_required ? (Boolean(run.output.next_action) ? 1 : 0) : 1;
    const forbidden = packet.expected.forbidden_terms.every((term) => !semanticText.includes(normalized(term))) ? 1 : 0;
    const hardFailureReasons = [];
    if (run.output.status === "satisfied" && packet.expected.status !== "satisfied") hardFailureReasons.push("false_completion");
    if (evidence === 0) hardFailureReasons.push("invalid_or_missing_evidence_reference");
    return { ...run, scores: { status, semantic, evidence, question, next_action_presence: nextAction, forbidden }, outcome_integrity_score: mean([status, semantic, evidence, question, nextAction, forbidden]), hard_failure: hardFailureReasons.length > 0, hard_failure_reasons: hardFailureReasons };
  });
  const aggregate = CONDITIONS.map((condition) => {
    const rows = scored.filter((item) => item.condition === condition);
    const reviews = raw.reviews.flatMap((group) => group.reviews).filter((item) => item.condition === condition);
    return { condition, run_count: rows.length, outcome_integrity_score: mean(rows.map((item) => item.outcome_integrity_score)), exact_status_rate: mean(rows.map((item) => item.scores.status)), evidence_reference_rate: mean(rows.map((item) => item.scores.evidence)), false_completion_rate: mean(rows.map((item) => item.hard_failure_reasons.includes("false_completion") ? 1 : 0)), unnecessary_clarification_rate: mean(rows.map((item) => !packetByKey.get(`${item.case_id}:${item.condition}`).expected.question_required && Boolean(item.output.clarifying_question) ? 1 : 0)), topic_isolation_rate: mean(rows.map((item) => item.scores.forbidden)), hard_failure_rate: mean(rows.map((item) => item.hard_failure ? 1 : 0)), blind_correctness: mean(reviews.map((item) => item.correctness / 4)), blind_evidence_binding: mean(reviews.map((item) => item.evidence_binding / 4)), blind_usefulness: mean(reviews.map((item) => item.usefulness / 4)), input_tokens: rows.reduce((sum, item) => sum + item.input_tokens, 0), output_tokens: rows.reduce((sum, item) => sum + item.output_tokens, 0), mean_latency_ms: mean(rows.map((item) => item.elapsed_ms)), total_cost_usd: rows.reduce((sum, item) => sum + item.cost_usd, 0) };
  });
  const byModel = MODELS.flatMap((model) => CONDITIONS.map((condition) => { const rows = scored.filter((item) => item.model === model && item.condition === condition); return { model, condition, run_count: rows.length, outcome_integrity_score: mean(rows.map((item) => item.outcome_integrity_score)), hard_failure_rate: mean(rows.map((item) => item.hard_failure ? 1 : 0)) }; }));
  const contours = [...new Set(scored.map((item) => item.contour))].sort();
  const byContour = contours.flatMap((contour) => CONDITIONS.map((condition) => { const rows = scored.filter((item) => item.contour === contour && item.condition === condition); return { contour, condition, run_count: rows.length, outcome_integrity_score: mean(rows.map((item) => item.outcome_integrity_score)), hard_failure_rate: mean(rows.map((item) => item.hard_failure ? 1 : 0)) }; }));
  const activeFailures = raw.failures.filter((item) => !item.recovered_at);
  const body = { study_id: raw.study_id, phase: raw.phase, packet_digest: raw.packet_digest, protocol_digest: raw.protocol_digest, raw_digest: digest(raw), scoring_revision: "2.0.0-committed-executable", run_count: scored.length, review_group_count: raw.reviews.length, failures: raw.failures, active_failure_count: activeFailures.length, hard_failures: scored.filter((item) => item.hard_failure).map((item) => ({ case_id: item.case_id, condition: item.condition, model: item.model, reasons: item.hard_failure_reasons })), total_cost_usd: raw.spent_usd, aggregate, by_model: byModel, by_contour: byContour, claims: ["This controlled replay estimates package-level engineering outcome integrity for the frozen corpus.", "AI-assisted condition-blind review is not external human review.", "The replay does not isolate one causal mechanism or test a production channel."], release_gate_recommendation: activeFailures.length ? "blocked_by_infrastructure_failure" : "eligible_for_rc_engineering_review", production_effects: false, canonical_write_allowed: false };
  return { ...body, digest: digest(body) };
}
