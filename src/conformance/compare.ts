import type { CorpusCaseResult, PureCorpusResult } from "./pure-corpus.js";

export interface ImplementationConformanceResult extends Omit<PureCorpusResult, "implementation"> {
  implementation: "typescript_reference" | "python_independent";
}

export interface ConformanceComparisonResult {
  contract_version: "1.0.0";
  corpus_id: string;
  reference_implementation: string;
  candidate_implementation: string;
  status: "match" | "mismatch";
  differences: string[];
}

function byId(cases: CorpusCaseResult[]): Map<string, CorpusCaseResult> {
  return new Map(cases.map((item) => [item.id, item]));
}

export function compareConformanceResults(
  reference: ImplementationConformanceResult,
  candidate: ImplementationConformanceResult
): ConformanceComparisonResult {
  const differences: string[] = [];
  for (const field of ["contract_version", "corpus_id", "corpus_digest", "status", "passed", "failed"] as const) {
    if (JSON.stringify(reference[field]) !== JSON.stringify(candidate[field])) {
      differences.push(`result:${field}:${String(reference[field])}:${String(candidate[field])}`);
    }
  }
  const referenceCases = byId(reference.cases);
  const candidateCases = byId(candidate.cases);
  const ids = [...new Set([...referenceCases.keys(), ...candidateCases.keys()])].sort();
  for (const id of ids) {
    const left = referenceCases.get(id);
    const right = candidateCases.get(id);
    if (!left) { differences.push(`case_unexpected:${id}`); continue; }
    if (!right) { differences.push(`case_missing:${id}`); continue; }
    for (const field of ["passed", "status", "trace_digest", "output_digest", "errors"] as const) {
      if (JSON.stringify(left[field]) !== JSON.stringify(right[field])) differences.push(`case:${id}:${field}`);
    }
  }
  return {
    contract_version: "1.0.0",
    corpus_id: reference.corpus_id || candidate.corpus_id,
    reference_implementation: reference.implementation,
    candidate_implementation: candidate.implementation,
    status: differences.length ? "mismatch" : "match",
    differences
  };
}

