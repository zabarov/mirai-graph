import fs from "node:fs";
import path from "node:path";
import { digestValue } from "../core/canonical.js";
import { assertNoSymlinkComponents } from "../core/path-boundary.js";
import type { EffectReceipt, SanitizedEvidencePackage } from "./contracts.js";
import { RunStore } from "./store.js";

function writeExclusive(filename: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
}

function sanitizeReceipt(receipt: EffectReceipt): SanitizedEvidencePackage["receipts"][number] {
  const trustedCode = receipt.failure?.code && /^[A-Za-z0-9._:-]{1,128}$/.test(receipt.failure.code) ? receipt.failure.code : undefined;
  return {
    contract_version: receipt.contract_version,
    receipt_id: receipt.receipt_id,
    sequence: receipt.sequence,
    idempotency_key: receipt.idempotency_key,
    run_id: receipt.run_id,
    program_id: receipt.program_id,
    program_digest: receipt.program_digest,
    node_id: receipt.node_id,
    invocation_id: receipt.invocation_id,
    adapter: receipt.adapter,
    operation: receipt.operation,
    effects: receipt.effects,
    args_digest: receipt.args_digest,
    status: receipt.status,
    attempt: receipt.attempt,
    prepared_at: receipt.prepared_at,
    ...(receipt.executed_at ? { executed_at: receipt.executed_at } : {}),
    ...(receipt.verified_at ? { verified_at: receipt.verified_at } : {}),
    ...(receipt.failed_at ? { failed_at: receipt.failed_at } : {}),
    ...(receipt.reconciled_at ? { reconciled_at: receipt.reconciled_at } : {}),
    ...(receipt.compensated_at ? { compensated_at: receipt.compensated_at } : {}),
    ...(receipt.result_digest ? { result_digest: receipt.result_digest } : {}),
    ...(receipt.verification ? { verification_status: receipt.verification.status } : {}),
    ...(trustedCode ? { failure_code: trustedCode } : receipt.failure?.code ? { failure_code_digest: digestValue(receipt.failure.code) } : {}),
    ...(receipt.failure ? { retry_safe: receipt.failure.retry_safe } : {}),
    ...(receipt.compensation ? { compensation_status: receipt.compensation.status } : {}),
    ...(receipt.compensation?.backup_ref ? { backup_ref: "redacted-host-local" as const } : {})
  };
}

export function buildSanitizedEvidence(runId: string, store: RunStore): SanitizedEvidencePackage {
  const run = store.readRun(runId);
  if (run.status !== "completed" && run.status !== "cancelled") throw new Error("evidence_export_requires_terminal_run");
  const episode = store.readEpisode(runId);
  const blockerCodes = run.blockers.map((value) => `untrusted:${digestValue(value)}`);
  return {
    contract_version: "1.0.0",
    run: {
      contract_version: run.contract_version,
      run_id: run.run_id,
      graph_id: run.graph_id,
      program_id: run.program_id,
      program_digest: run.program_digest,
      input_digest: run.input_digest,
      status: run.status,
      revision: run.revision,
      event_sequence: run.event_sequence,
      apply_requested: run.apply_requested,
      created_at: run.created_at,
      updated_at: run.updated_at,
      ...(run.started_at ? { started_at: run.started_at } : {}),
      ...(run.finished_at ? { finished_at: run.finished_at } : {}),
      blocker_codes: blockerCodes,
      limitations: run.limitations,
      program_ref: run.program_ref,
      input_ref: run.input_ref,
      checkpoint_ref: run.checkpoint_ref,
      ...(run.episode_ref ? { episode_ref: run.episode_ref } : {}),
      sandbox_ref: "redacted-host-local"
    },
    episode: {
      contract_version: "1.0.0",
      episode_id: episode.episode_id,
      run_id: episode.run_id,
      program_id: episode.program_id,
      program_digest: episode.program_digest,
      input_digest: episode.input_digest,
      status: episode.status,
      output_digest: episode.output_digest,
      trace_digest: episode.trace_digest,
      steps: episode.steps,
      logical_duration_ms: episode.logical_duration_ms,
      effects_executed: episode.effects_executed,
      replay_input_digest: digestValue(episode.replay_input),
      effect_summaries: episode.effect_stubs.map((item) => ({
        sequence: item.sequence,
        ...(item.receipt_id ? { receipt_id: item.receipt_id } : {}),
        node_id: item.node_id,
        invocation_id: item.invocation_id,
        adapter: item.adapter,
        operation: item.operation,
        args_digest: item.args_digest,
        status: item.status,
        ...(item.result_digest ? { result_digest: item.result_digest } : {}),
        ...(item.error_code ? (/^[A-Za-z0-9._:-]{1,128}$/.test(item.error_code) ? { error_code: item.error_code } : { error_code: `untrusted:${digestValue(item.error_code)}` }) : {}),
        ...(item.error_message ? { error_message_digest: digestValue(item.error_message) } : {})
      })),
      canonical_write_allowed: false,
      learning_update_allowed: false,
      limitations: episode.limitations
    },
    receipts: store.listReceipts(runId).map(sanitizeReceipt),
    exported_at: new Date().toISOString(),
    canonical_write_allowed: false,
    limitations: [
      "Content, external outputs, capability grants, approval signatures, sandbox paths and backups are excluded.",
      "Evidence supports audit of this run only and does not authorize canonical updates."
    ]
  };
}

export function exportSanitizedEvidence(runId: string, outputDirectory: string, options: { store?: RunStore; home?: string } = {}): string {
  const store = options.store || new RunStore(options.home);
  const target = assertNoSymlinkComponents(outputDirectory, true, "evidence_output");
  if (fs.existsSync(target) && fs.readdirSync(target).length) throw new Error("evidence_output_directory_not_empty");
  fs.mkdirSync(target, { recursive: true });
  const filename = path.join(target, "mirai-evidence.json");
  writeExclusive(filename, buildSanitizedEvidence(runId, store));
  return filename;
}
