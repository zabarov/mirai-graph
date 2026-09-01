import fs from "node:fs";
import path from "node:path";
import { digestValue } from "../core/canonical.js";
import type { EffectReceipt, SanitizedEvidencePackage } from "./contracts.js";
import { RunStore } from "./store.js";

function writeExclusive(filename: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
}

function sanitizeReceipt(receipt: EffectReceipt): SanitizedEvidencePackage["receipts"][number] {
  const { result: _result, capability_grant_ref: _grant, ...safe } = receipt;
  if (safe.failure) safe.failure = { ...safe.failure, message: safe.failure.code };
  if (safe.compensation?.backup_ref) safe.compensation = { ...safe.compensation, backup_ref: "redacted-host-local" };
  return safe;
}

export function buildSanitizedEvidence(runId: string, store: RunStore): SanitizedEvidencePackage {
  const run = store.readRun(runId);
  if (run.status !== "completed" && run.status !== "cancelled") throw new Error("evidence_export_requires_terminal_run");
  const episode = store.readEpisode(runId);
  const { sandbox: _sandbox, approval_receipt_ref: _approval, ...safeRun } = run;
  return {
    contract_version: "1.0.0",
    run: { ...safeRun, sandbox_ref: "redacted-host-local" },
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
      effect_summaries: episode.effect_stubs.map(({ result: _result, error_message: message, ...summary }) => ({
        ...summary,
        ...(message ? { error_message_digest: digestValue(message) } : {})
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
  const target = path.resolve(outputDirectory);
  if (fs.existsSync(target) && fs.readdirSync(target).length) throw new Error("evidence_output_directory_not_empty");
  fs.mkdirSync(target, { recursive: true });
  const filename = path.join(target, "mirai-evidence.json");
  writeExclusive(filename, buildSanitizedEvidence(runId, store));
  return filename;
}
