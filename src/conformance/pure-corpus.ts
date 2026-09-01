import fs from "node:fs";
import path from "node:path";
import { digestValue } from "../core/canonical.js";
import { compileProgramFile, ProgramCompilationError } from "../program/compiler.js";
import { executePure } from "../runtime/pure-interpreter.js";

interface CorpusCase {
  id: string;
  program: string;
  input?: Record<string, unknown>;
  events?: Record<string, unknown>;
  imports?: Record<string, string>;
  expected_outputs?: Record<string, unknown>;
  expected_status?: "completed" | "cancelled";
  expected_decisions?: string[];
  expected_emitted_events?: string[];
  repetitions?: number;
  expected_validation_error?: string;
}

interface Corpus {
  contract_version: "1.0.0";
  id: string;
  cases: CorpusCase[];
}

export interface CorpusCaseResult {
  id: string;
  passed: boolean;
  status: string;
  trace_digest?: string;
  output_digest?: string;
  errors: string[];
}

export interface PureCorpusResult {
  contract_version: "1.0.0";
  corpus_id: string;
  corpus_digest: string;
  implementation: "typescript_reference";
  status: "passed" | "failed";
  passed: number;
  failed: number;
  cases: CorpusCaseResult[];
}

function equal(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function runPureCorpus(filename: string): Promise<PureCorpusResult> {
  const absolute = path.resolve(filename);
  const corpus = JSON.parse(fs.readFileSync(absolute, "utf8")) as Corpus;
  if (corpus.contract_version !== "1.0.0" || !corpus.id || !Array.isArray(corpus.cases)) throw new Error("invalid_pure_conformance_corpus");
  const directory = path.dirname(absolute);
  const results: CorpusCaseResult[] = [];
  for (const item of corpus.cases) {
    try {
      const program = compileProgramFile(path.resolve(directory, item.program)).program;
      if (item.expected_validation_error) {
        results.push({ id: item.id, passed: false, status: "unexpected_validation_success", errors: ["expected_validation_error_missing"] });
        continue;
      }
      const repetitions = item.repetitions || 1;
      const programs: Record<string, ReturnType<typeof compileProgramFile>["program"]> = {};
      for (const [alias, source] of Object.entries(item.imports || {})) {
        const imported = compileProgramFile(path.resolve(directory, source)).program;
        programs[alias] = imported;
        programs[imported.id] = imported;
      }
      const episodes = [];
      for (let index = 0; index < repetitions; index += 1) {
        episodes.push(await executePure(program, item.input || {}, { programs, events: item.events || {} }));
      }
      const first = episodes[0];
      const errors: string[] = [];
      if (!first) errors.push("episode_missing");
      else {
        if (item.expected_status && first.status !== item.expected_status) errors.push(`status:${first.status}:${item.expected_status}`);
        if (item.expected_outputs && !equal(first.outputs, item.expected_outputs)) errors.push("outputs_mismatch");
        const decisions = first.trace.map((event) => event.decision);
        for (const decision of item.expected_decisions || []) if (!decisions.includes(decision)) errors.push(`decision_missing:${decision}`);
        const emitted = first.emitted_events.map((event) => event.event);
        for (const event of item.expected_emitted_events || []) if (!emitted.includes(event)) errors.push(`emitted_event_missing:${event}`);
        if (new Set(episodes.map((episode) => episode.trace_digest)).size !== 1) errors.push("trace_nondeterministic");
        if (new Set(episodes.map((episode) => episode.output_digest)).size !== 1) errors.push("output_nondeterministic");
      }
      results.push({
        id: item.id,
        passed: errors.length === 0,
        status: errors.length ? "failed" : "passed",
        trace_digest: first?.trace_digest,
        output_digest: first?.output_digest,
        errors
      });
    } catch (error) {
      const validationErrors = error instanceof ProgramCompilationError ? error.validation.errors : [];
      const expected = item.expected_validation_error;
      const passed = Boolean(expected && validationErrors.some((message) => message.includes(expected)));
      results.push({
        id: item.id,
        passed,
        status: passed ? "expected_validation_failure" : "failed",
        errors: passed ? [] : validationErrors.length ? validationErrors : [error instanceof Error ? error.message : String(error)]
      });
    }
  }
  const failed = results.filter((item) => !item.passed).length;
  return {
    contract_version: "1.0.0",
    corpus_id: corpus.id,
    corpus_digest: digestValue(corpus),
    implementation: "typescript_reference",
    status: failed ? "failed" : "passed",
    passed: results.length - failed,
    failed,
    cases: results
  };
}
