import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { sha256 } from "../core/canonical.js";
import type { ApprovalReceipt, EffectReceipt } from "../runtime/contracts.js";
import type { AdapterExecutionContext, AdapterOperation, AdapterRegistry } from "./types.js";

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) throw new Error(`${label}_required`);
  if (value.includes("\u0000")) throw new Error(`${label}_nul_forbidden`);
  return value;
}

function asText(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label}_required`);
  if (value.includes("\u0000")) throw new Error(`${label}_nul_forbidden`);
  return value;
}

function boundedOutput(value: string, maxBytes: number): { value: string; truncated: boolean } {
  const buffer = Buffer.from(value);
  if (buffer.byteLength <= maxBytes) return { value, truncated: false };
  return { value: buffer.subarray(0, maxBytes).toString("utf8"), truncated: true };
}

export function resolveSandboxPath(sandbox: string, requested: string, allowMissing = false): string {
  if (path.isAbsolute(requested)) throw new Error("absolute_path_forbidden");
  const root = path.resolve(sandbox);
  const target = path.resolve(root, requested);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error("path_traversal_forbidden");
  const relative = path.relative(root, target);
  let cursor = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    if (!fs.existsSync(cursor)) {
      if (allowMissing) break;
      throw new Error(`path_missing:${requested}`);
    }
    if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error(`symlink_path_forbidden:${requested}`);
  }
  return target;
}

function receiptResult(receipt: EffectReceipt): Record<string, unknown> {
  if (!receipt.result || typeof receipt.result !== "object" || Array.isArray(receipt.result)) throw new Error("receipt_result_missing");
  return receipt.result as Record<string, unknown>;
}

const repositoryReadFile: AdapterOperation = {
  effect: "repository_read",
  async execute(args, context) {
    const requested = asString(args.path, "repository_path");
    const filename = resolveSandboxPath(context.sandbox, requested);
    const stat = fs.statSync(filename);
    if (!stat.isFile()) throw new Error("repository_path_not_file");
    if (stat.size > context.max_bytes) throw new Error("repository_read_budget_exceeded");
    const content = fs.readFileSync(filename, "utf8");
    return { path: requested, encoding: "utf8", content, size: Buffer.byteLength(content), sha256: sha256(content) };
  },
  async verify(receipt, context) {
    const result = receiptResult(receipt);
    const filename = resolveSandboxPath(context.sandbox, asString(result.path, "receipt_path"));
    const digest = sha256(fs.readFileSync(filename));
    return { verified: digest === result.sha256, details: [`current_digest:${digest}`] };
  }
};

const repositoryListFiles: AdapterOperation = {
  effect: "repository_read",
  async execute(args, context) {
    const requested = typeof args.path === "string" ? args.path : ".";
    const directory = resolveSandboxPath(context.sandbox, requested);
    if (!fs.statSync(directory).isDirectory()) throw new Error("repository_path_not_directory");
    const maxEntries = Number.isInteger(args.max_entries) ? Math.min(Number(args.max_entries), 1000) : 200;
    const files: string[] = [];
    const queue = [directory];
    while (queue.length && files.length < maxEntries) {
      const current = queue.shift() as string;
      for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.name === ".git" || entry.isSymbolicLink()) continue;
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory()) queue.push(absolute);
        else if (entry.isFile()) files.push(path.relative(context.sandbox, absolute));
        if (files.length >= maxEntries) break;
      }
    }
    return { path: requested, files, truncated: queue.length > 0 || files.length >= maxEntries };
  },
  async verify(receipt) {
    return { verified: Array.isArray(receiptResult(receipt).files), details: ["listing_shape_verified"] };
  }
};

function runGit(args: string[], context: AdapterExecutionContext): Record<string, unknown> {
  const execution = spawnSync("git", args, {
    cwd: context.sandbox,
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: context.max_bytes,
    env: { PATH: process.env.PATH || "", HOME: process.env.HOME || "", LANG: "C" }
  });
  if (execution.error) throw execution.error;
  const stdout = boundedOutput(execution.stdout || "", context.max_bytes);
  const stderr = boundedOutput(execution.stderr || "", context.max_bytes);
  if ((execution.status ?? 1) !== 0) throw new Error(`git_command_failed:${execution.status}:${stderr.value}`);
  return { exit_code: execution.status, stdout: stdout.value, stderr: stderr.value, truncated: stdout.truncated || stderr.truncated };
}

const gitStatus: AdapterOperation = {
  effect: "git_read",
  async execute(_args, context) { return runGit(["status", "--short", "--branch"], context); },
  async verify(receipt) { return { verified: typeof receiptResult(receipt).stdout === "string", details: ["recorded_git_output_verified"] }; }
};

const gitDiff: AdapterOperation = {
  effect: "git_read",
  async execute(args, context) {
    const paths = Array.isArray(args.paths) ? args.paths.map((item) => asString(item, "git_path")) : [];
    for (const item of paths) resolveSandboxPath(context.sandbox, item, true);
    return runGit(["diff", "--", ...paths], context);
  },
  async verify(receipt) { return { verified: typeof receiptResult(receipt).stdout === "string", details: ["recorded_git_diff_verified"] }; }
};

const workspaceWriteFile: AdapterOperation = {
  effect: "workspace_patch",
  async execute(args, context) {
    const requested = asString(args.path, "workspace_path");
    const content = asText(args.content, "workspace_content");
    if (Buffer.byteLength(content) > context.max_bytes) throw new Error("workspace_write_budget_exceeded");
    const target = resolveSandboxPath(context.sandbox, requested, true);
    const exists = fs.existsSync(target);
    const expected = asString(args.expected_sha256, "expected_sha256");
    const previous = exists ? fs.readFileSync(target) : undefined;
    const previousDigest = previous ? sha256(previous) : "missing";
    if (expected !== previousDigest) throw new Error(`workspace_compare_and_swap_failed:${expected}:${previousDigest}`);
    const backupRef = context.store.writeBackup(context.run_id, context.idempotency_key, {
      path: requested,
      existed: exists,
      content_base64: previous?.toString("base64") || "",
      sha256: previousDigest
    });
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temporary = `${target}.mirai-${randomBytes(6).toString("hex")}.tmp`;
    fs.writeFileSync(temporary, content, { flag: "wx" });
    fs.renameSync(temporary, target);
    const readback = fs.readFileSync(target);
    if (!readback.equals(Buffer.from(content))) throw new Error("workspace_write_readback_mismatch");
    return { path: requested, sha256: sha256(readback), size: readback.byteLength, previous_sha256: previousDigest, backup_ref: backupRef };
  },
  async verify(receipt, context) {
    const result = receiptResult(receipt);
    const target = resolveSandboxPath(context.sandbox, asString(result.path, "receipt_path"));
    const current = sha256(fs.readFileSync(target));
    return { verified: current === result.sha256, details: [`current_digest:${current}`] };
  },
  async compensate(receipt, context) {
    const result = receiptResult(receipt);
    const backupRef = asString(result.backup_ref, "backup_ref");
    const backup = context.store.readArtifact<{ path: string; existed: boolean; content_base64: string; sha256: string }>(context.run_id, backupRef);
    const target = resolveSandboxPath(context.sandbox, backup.path, true);
    if (backup.existed) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const content = Buffer.from(backup.content_base64, "base64");
      fs.writeFileSync(target, content);
      if (sha256(fs.readFileSync(target)) !== backup.sha256) return { compensated: false, details: ["restore_readback_mismatch"] };
    } else if (fs.existsSync(target)) fs.unlinkSync(target);
    return { compensated: true, details: [backup.existed ? "previous_content_restored" : "created_file_removed"] };
  }
};

const testRun: AdapterOperation = {
  effect: "process_run",
  async execute(args, context) {
    const commandId = asString(args.command_id, "command_id");
    const definition = context.test_commands[commandId];
    if (!definition) throw new Error(`test_command_not_allowlisted:${commandId}`);
    const execution = spawnSync(definition.command, definition.args, {
      cwd: context.sandbox,
      encoding: "utf8",
      timeout: definition.timeout_ms,
      maxBuffer: definition.max_output_bytes,
      shell: false,
      env: { PATH: process.env.PATH || "", HOME: process.env.HOME || "", TMPDIR: process.env.TMPDIR || "/tmp", CI: "1" }
    });
    if (execution.error) throw execution.error;
    const stdout = boundedOutput(execution.stdout || "", definition.max_output_bytes);
    const stderr = boundedOutput(execution.stderr || "", definition.max_output_bytes);
    return {
      command_id: commandId,
      exit_code: execution.status,
      signal: execution.signal,
      stdout: stdout.value,
      stderr: stderr.value,
      stdout_sha256: sha256(stdout.value),
      stderr_sha256: sha256(stderr.value),
      truncated: stdout.truncated || stderr.truncated
    };
  },
  async verify(receipt) {
    const result = receiptResult(receipt);
    const exitCode = result.exit_code;
    return {
      verified: exitCode === 0,
      details: [Number.isInteger(exitCode) ? `exit_code:${String(exitCode)}` : "exit_code:missing"]
    };
  }
};

const humanApproval: AdapterOperation = {
  effect: "human_approval",
  async execute(_args, context) {
    const receipt = context.approval as ApprovalReceipt | undefined;
    if (!receipt) throw new Error("approval_receipt_required");
    return { approval_id: receipt.approval_id, approver: receipt.approver, issued_at: receipt.issued_at, expires_at: receipt.expires_at };
  },
  async verify(receipt) { return { verified: typeof receiptResult(receipt).approval_id === "string", details: ["approval_receipt_was_host_verified"] }; }
};

export const REFERENCE_ADAPTERS: AdapterRegistry = {
  repository: { read_file: repositoryReadFile, list_files: repositoryListFiles },
  git: { status: gitStatus, diff: gitDiff },
  workspace: { write_file: workspaceWriteFile },
  test: { run: testRun },
  human: { approval: humanApproval }
};

export function getAdapterOperation(registry: AdapterRegistry, adapter: string, operation: string): AdapterOperation {
  const result = registry[adapter]?.[operation];
  if (!result) throw new Error(`adapter_operation_not_found:${adapter}.${operation}`);
  return result;
}
