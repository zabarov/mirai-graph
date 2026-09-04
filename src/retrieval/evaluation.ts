import { digestValue } from "../core/index.js";
import type { RetrievalAnswer, RetrievalEvaluation, RetrievalHit } from "./types.js";

export interface RetrievalEvaluationCase {
  expected_document_ids: string[];
  relevance?: Record<string, number>;
  expected_intent: string;
  predicted_intent: string;
  hits: RetrievalHit[];
  answer: RetrievalAnswer;
  latency_ms: number;
  expected_graph_path?: string[];
  conflict_expected?: boolean;
  stale_expected?: boolean;
  unauthorized_document_ids?: string[];
  model_calls?: number;
  input_tokens?: number;
  cost_usd?: number;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percentile(values: number[], quantile: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1))] as number;
}

export function evaluateRetrieval(corpusId: string, system: RetrievalEvaluation["system"], cases: RetrievalEvaluationCase[], k = 10): RetrievalEvaluation {
  if (!cases.length || !Number.isSafeInteger(k) || k < 1) throw new Error("retrieval_evaluation_cases_required");
  const recalls: number[] = [];
  const ndcgs: number[] = [];
  const reciprocalRanks: number[] = [];
  const pathScores: number[] = [];
  const evidenceScores: number[] = [];
  const faithfulnessScores: number[] = [];
  const conflictScores: number[] = [];
  const staleScores: number[] = [];
  let conflictReported = 0;
  let conflictTruePositive = 0;
  let conflictNegativeCases = 0;
  let staleReported = 0;
  let staleTruePositive = 0;
  let staleNegativeCases = 0;
  let unauthorized = 0;
  let stale = 0;
  let hitCount = 0;
  for (const item of cases) {
    const expected = new Set(item.expected_document_ids);
    const relevance = item.relevance || Object.fromEntries(item.expected_document_ids.map((id) => [id, 1]));
    const ids = item.hits.slice(0, k).map((hit) => hit.document_id);
    recalls.push(expected.size ? ids.filter((id) => expected.has(id)).length / expected.size : 1);
    let dcg = 0;
    ids.forEach((id, index) => { const grade = relevance[id] || 0; if (grade > 0) dcg += (2 ** grade - 1) / Math.log2(index + 2); });
    const ideal = Object.values(relevance).filter((grade) => grade > 0).sort((a, b) => b - a).slice(0, k).reduce((sum, grade, index) => sum + (2 ** grade - 1) / Math.log2(index + 2), 0);
    ndcgs.push(ideal ? dcg / ideal : 1);
    const first = ids.findIndex((id) => expected.has(id));
    reciprocalRanks.push(first < 0 ? 0 : 1 / (first + 1));
    if (item.expected_graph_path) pathScores.push(item.hits.some((hit) => JSON.stringify(hit.graph_path) === JSON.stringify(item.expected_graph_path)) ? 1 : 0);
    evidenceScores.push(item.answer.claims.length ? item.answer.claims.filter((claim) => claim.evidence_refs.length > 0 && claim.source_refs.length > 0).length / item.answer.claims.length : item.answer.status === "insufficient_evidence" || item.answer.status === "clarification_required" ? 1 : 0);
    faithfulnessScores.push(item.answer.claims.length ? item.answer.claims.filter((claim) => item.hits.some((hit) => claim.source_refs.includes(hit.source_ref) && claim.evidence_refs.some((ref) => hit.evidence_refs.includes(ref)) && claim.text.includes(hit.title))).length / item.answer.claims.length : ["insufficient_evidence", "clarification_required"].includes(item.answer.status) ? 1 : 0);
    const reportsConflict = item.answer.conflicts.some((value) => value.startsWith("conflict:"));
    const reportsStale = item.answer.conflicts.some((value) => value.startsWith("stale:"));
    if (item.conflict_expected) conflictScores.push(reportsConflict ? 1 : 0);
    else conflictNegativeCases += 1;
    if (reportsConflict) { conflictReported += 1; if (item.conflict_expected) conflictTruePositive += 1; }
    if (item.stale_expected) staleScores.push(reportsStale ? 1 : 0);
    else staleNegativeCases += 1;
    if (reportsStale) { staleReported += 1; if (item.stale_expected) staleTruePositive += 1; }
    const unauthorizedIds = new Set(item.unauthorized_document_ids || []);
    unauthorized += item.hits.filter((hit) => unauthorizedIds.has(hit.document_id)).length;
    stale += item.hits.filter((hit) => hit.freshness === "stale").length;
    hitCount += item.hits.length;
  }
  const body = {
    contract_version: "1.0.0" as const,
    corpus_id: corpusId,
    system,
    recall_at_k: mean(recalls),
    ndcg_at_k: mean(ndcgs),
    mrr: mean(reciprocalRanks),
    intent_accuracy: cases.filter((item) => item.expected_intent === item.predicted_intent).length / cases.length,
    path_correctness: mean(pathScores),
    path_case_count: pathScores.length,
    evidence_coverage: mean(evidenceScores),
    claim_faithfulness: mean(faithfulnessScores),
    conflict_detection_rate: mean(conflictScores),
    conflict_case_count: conflictScores.length,
    conflict_precision: conflictReported ? conflictTruePositive / conflictReported : 1,
    conflict_negative_case_count: conflictNegativeCases,
    stale_detection_rate: mean(staleScores),
    stale_case_count: staleScores.length,
    stale_precision: staleReported ? staleTruePositive / staleReported : 1,
    stale_negative_case_count: staleNegativeCases,
    unauthorized_hit_count: unauthorized,
    stale_hit_rate: hitCount ? stale / hitCount : 0,
    p50_latency_ms: percentile(cases.map((item) => item.latency_ms), 0.5),
    p95_latency_ms: percentile(cases.map((item) => item.latency_ms), 0.95),
    model_calls: cases.reduce((sum, item) => sum + (item.model_calls || 0), 0),
    input_tokens: cases.reduce((sum, item) => sum + (item.input_tokens || 0), 0),
    cost_usd: cases.reduce((sum, item) => sum + (item.cost_usd || 0), 0),
    limitations: ["Synthetic evaluation does not establish external task effectiveness or production readiness."]
  };
  return { ...body, digest: digestValue(body) };
}
