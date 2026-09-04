import { digestValue } from "../core/index.js";
import type { RetrievalAnswer, RetrievalEvaluation, RetrievalHit } from "./types.js";

export interface RetrievalEvaluationCase {
  expected_document_ids: string[];
  expected_intent: string;
  predicted_intent: string;
  hits: RetrievalHit[];
  answer: RetrievalAnswer;
  latency_ms: number;
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
  let unauthorized = 0;
  let stale = 0;
  let hitCount = 0;
  for (const item of cases) {
    const expected = new Set(item.expected_document_ids);
    const ids = item.hits.slice(0, k).map((hit) => hit.document_id);
    recalls.push(expected.size ? ids.filter((id) => expected.has(id)).length / expected.size : 1);
    let dcg = 0;
    ids.forEach((id, index) => { if (expected.has(id)) dcg += 1 / Math.log2(index + 2); });
    const ideal = [...expected].slice(0, k).reduce((sum, _id, index) => sum + 1 / Math.log2(index + 2), 0);
    ndcgs.push(ideal ? dcg / ideal : 1);
    const first = ids.findIndex((id) => expected.has(id));
    reciprocalRanks.push(first < 0 ? 0 : 1 / (first + 1));
    const relevant = item.hits.filter((hit) => expected.has(hit.document_id));
    pathScores.push(relevant.length ? relevant.filter((hit) => !hit.channels.includes("graph") || Boolean(hit.graph_path)).length / relevant.length : 0);
    evidenceScores.push(item.answer.claims.length ? item.answer.claims.filter((claim) => claim.evidence_refs.length > 0 && claim.source_refs.length > 0).length / item.answer.claims.length : item.answer.status === "insufficient_evidence" || item.answer.status === "clarification_required" ? 1 : 0);
    unauthorized += item.hits.filter((hit) => hit.match_reasons.includes("unauthorized")).length;
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
    evidence_coverage: mean(evidenceScores),
    unauthorized_hit_count: unauthorized,
    stale_hit_rate: hitCount ? stale / hitCount : 0,
    p50_latency_ms: percentile(cases.map((item) => item.latency_ms), 0.5),
    p95_latency_ms: percentile(cases.map((item) => item.latency_ms), 0.95),
    limitations: ["Synthetic evaluation does not establish external task effectiveness or production readiness."]
  };
  return { ...body, digest: digestValue(body) };
}
