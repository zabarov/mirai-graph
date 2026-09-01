import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ReceiptStatus, RunStatus } from "./contracts.js";
import { RunStore } from "./store.js";

const runStatuses: RunStatus[] = ["prepared", "running", "completed", "cancelled", "failed", "blocked"];
const receiptStatuses: ReceiptStatus[] = ["prepared", "executed", "verified", "failed", "uncertain", "compensated"];

export interface RuntimeHealthReport {
  contract_version: "1.0.0";
  status: "empty" | "healthy" | "degraded" | "blocked";
  host_state_ref: "host-local://mirai-home";
  run_counts: Record<RunStatus, number>;
  receipt_counts: Record<ReceiptStatus, number>;
  recovery_required_runs: string[];
  active_run_ids: string[];
  diagnostics: string[];
  sensitive_data_exposed: false;
  canonical_write_allowed: false;
}

function zeroCounts<T extends string>(keys: T[]): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
}

export function inspectRuntimeHealth(home = process.env.MIRAI_HOME || path.join(os.homedir(), ".mirai")): RuntimeHealthReport {
  const report: RuntimeHealthReport = {
    contract_version: "1.0.0",
    status: "empty",
    host_state_ref: "host-local://mirai-home",
    run_counts: zeroCounts(runStatuses),
    receipt_counts: zeroCounts(receiptStatuses),
    recovery_required_runs: [],
    active_run_ids: [],
    diagnostics: [],
    sensitive_data_exposed: false,
    canonical_write_allowed: false
  };
  const resolved = path.resolve(home);
  if (!fs.existsSync(resolved)) return report;

  try {
    const store = new RunStore(resolved, { create: false });
    const runIds = store.listRunIds();
    for (const runId of runIds) {
      const run = store.readRun(runId);
      report.run_counts[run.status] += 1;
      if (["prepared", "running", "blocked"].includes(run.status)) report.active_run_ids.push(runId);
      const receipts = store.listReceipts(runId);
      for (const receipt of receipts) report.receipt_counts[receipt.status] += 1;
      const needsRecovery = run.status === "blocked"
        || receipts.some((receipt) => ["prepared", "executed", "uncertain"].includes(receipt.status))
        || receipts.some((receipt) => receipt.compensation?.status === "not_available" && receipt.status === "failed");
      if (needsRecovery) report.recovery_required_runs.push(runId);
      try {
        const checkpoint = store.readCheckpoint(runId);
        if (checkpoint.run_id !== runId) report.diagnostics.push(`checkpoint_run_mismatch:${runId}`);
      } catch {
        report.diagnostics.push(`checkpoint_unreadable:${runId}`);
        if (!report.recovery_required_runs.includes(runId)) report.recovery_required_runs.push(runId);
      }
    }
    report.active_run_ids.sort();
    report.recovery_required_runs.sort();
    if (!runIds.length) report.status = "empty";
    else if (report.recovery_required_runs.length || report.diagnostics.length) report.status = "blocked";
    else if (report.active_run_ids.length || report.run_counts.failed > 0) report.status = "degraded";
    else report.status = "healthy";
  } catch {
    report.status = "blocked";
    report.diagnostics.push("runtime_inventory_unreadable");
  }
  return report;
}
