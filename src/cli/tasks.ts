import { REFERENCE_ADAPTERS, type AdapterRegistry } from "../adapters/index.js";
import { createTaskRuntimeAdapters, inspectTaskRuntime, taskRuntimeRegistryDigest } from "../tasks/runtime-bridge.js";
import { loadTaskRuntimeRegistry } from "../tasks/registry-file.js";

function option(args: string[], name: string): string | undefined {
  const positions = args.flatMap((value, index) => value === name ? [index] : []);
  if (!positions.length) return undefined;
  const index = positions[0]!;
  if (positions.length !== 1 || !args[index + 1] || args[index + 1]!.startsWith("--")) throw new Error("task_cli_option_invalid");
  return args[index + 1];
}

export function loadTaskCliAdapters(args: string[]): AdapterRegistry | undefined {
  const filename = option(args, "--task-registry");
  if (!filename) return undefined;
  return { ...REFERENCE_ADAPTERS, ...createTaskRuntimeAdapters(loadTaskRuntimeRegistry(filename)) };
}

export function runTaskCli(args: string[]): number {
  let result: unknown;
  if (args[1] === "validate" && args.length === 3) {
    const registry = loadTaskRuntimeRegistry(args[2]!);
    result = { valid: true, registry_digest: taskRuntimeRegistryDigest(registry), plan_digest: registry.plans[0]!.digest,
      task_count: registry.plans[0]!.requests.length, receiver_count: registry.receivers.length,
      provider_modes: [...new Set(registry.receivers.map(r => r.kind === "ai" ? "recorded_ai" : "pure_program"))].sort(),
      network_enabled: false, canonical_write_allowed: false };
  } else if (args[1] === "inspect" && args[2] && args.length >= 5) {
    const options = args.slice(3);
    for (let index = 0; index < options.length; index += 2)
      if (!["--home", "--task-registry"].includes(options[index]!)) throw new Error("task_cli_option_unknown");
    const filename = option(options, "--task-registry");
    if (!filename) throw new Error("task_cli_registry_required");
    result = inspectTaskRuntime(args[2], loadTaskRuntimeRegistry(filename), { home: option(options, "--home") || process.env.MIRAI_HOME });
  } else throw new Error("usage: mirai task validate <registry.json> | inspect <run-id> --task-registry <registry.json> [--home <dir>]");
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return 0;
}
