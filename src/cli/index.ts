import fs from "node:fs";
import path from "node:path";
import { compileProgramFile, ProgramCompilationError } from "../program/compiler.js";
import { migrateTechnologyTarget } from "../program/migration.js";
import { simulatePlan } from "../program/planner.js";
import type { MiraiProgram } from "../program/types.js";
import { executePure, type PureEpisode } from "../runtime/pure-interpreter.js";
import { replayPure } from "../runtime/replay.js";
import { runPureCorpus } from "../conformance/pure-corpus.js";
import { compareConformanceResults, type ImplementationConformanceResult } from "../conformance/compare.js";
import {
  RunStore,
  cancelGovernedRun,
  createApprovalReceipt,
  exportSanitizedEvidence,
  inspectGovernedRun,
  inspectRuntimeHealth,
  reconcileGovernedRun,
  replayGovernedEpisode,
  resumeGovernedRun,
  startGovernedRun,
  type ApprovalReceipt,
  type ApprovalRequestScope,
  type CapabilityRequest,
  type CapabilityPolicy,
  type EffectName,
  type GovernedEpisode
} from "../runtime/index.js";
import type { TestCommandDefinition } from "../adapters/index.js";
import { assimilateCatalog, scanSource, type SourceCatalog } from "../assimilation/index.js";
import { validateComponentPackage, type ComponentPackage } from "../components/index.js";
import {
  compileHybridTechnologyPlan,
  compileTechnologyDraft,
  extractTechnologyFile,
  qualifyTechnologyDraft,
  type OperationQualificationBinding,
  type TechnologyDraft,
  type TechnologyQualificationResult
} from "../technology/index.js";
import {
  resolveActivationPlan,
  runActivationPlan,
  simulateActivationPlan,
  validateActivationPlan,
  type ActivationGraphSnapshot,
  type ActivationPlan,
  type ActivationSignal,
  type JoinPolicy
} from "../activation/index.js";
import {
  applyProjectMigration,
  compileProjectCapsule,
  createBootstrapProposal,
  detectProjectCapsule,
  initProjectCapsule,
  inspectProjectForAgent,
  planProjectMigration,
  rollbackProjectMigration,
  validateProjectCapsule
} from "../project/index.js";

function usage(): void {
  process.stderr.write([
    "Mirai 2 CLI (alpha.3)",
    "Additive Mirai 2.1 development contracts are available for assimilation, components, technology and activation.",
    "",
    "  mirai program validate <program.mirai.yaml|program.mirai.json>",
    "  mirai compile <source.mirai.yaml> --out <program.mirai.json>",
    "  mirai program plan <program>",
    "  mirai simulate <program> [--input <input.json>] [--events <events.json>] [--import <alias=program>]",
    "  mirai replay <episode|run-id> --program <program> [--home <mirai-home>] [--import <alias=program>]",
    "  mirai conformance run <corpus.json>",
    "  mirai conformance compare <reference-result.json> <candidate-result.json>",
    "  mirai approval create <program.mirai.json> --sandbox <dir> --requests <requests.json> --out <receipt.json>",
    "  mirai run <program.mirai.json> --input <input.json> --sandbox <dir> [--apply --approval <receipt.json>]",
    "  mirai resume <run-id> [--approval <receipt.json>] [--home <mirai-home>]",
    "  mirai cancel <run-id> [--home <mirai-home>]",
    "  mirai reconcile <run-id> [--home <mirai-home>]",
    "  mirai inspect <run-id> [--home <mirai-home>]",
    "  mirai operations status [--home <mirai-home>]",
    "  mirai evidence export <run-id> --out <dir> [--home <mirai-home>]",
    "  mirai migrate <technology-or-project> --from 1.4 --dry-run [--bindings <bindings.json>]",
    "  mirai source scan <path> [--out <catalog.json>]",
    "  mirai assimilate <catalog.json> --out <proposal.json>",
    "  mirai technology extract <source> --out <draft.json>",
    "  mirai technology qualify <draft.json> --bindings <bindings.json> --out <qualification.json>",
    "  mirai technology hybrid-compile <draft.json> --qualification <qualification.json> --out <plan.json>",
    "  mirai technology compile <draft.json> --out <program.mirai.json>",
    "  mirai component validate <component-package.json>",
    "  mirai activation plan --graph <snapshot.json> --signal <signal.json> --out <plan.json>",
    "  mirai activation simulate <plan.json>",
    "  mirai activation run <plan.json> --sandbox <dir> [--base-dir <dir>] [--input <input.json>] [--home <mirai-home>]",
    "  mirai project init [path] --profile <profile>",
    "  mirai project detect [path] [--json|--markdown]",
    "  mirai project compile [path]",
    "  mirai project validate [path]",
    "  mirai project inspect [path] --for-agent --task <task>",
    "  mirai project status [path]",
    "  mirai project migrate [path] --from graph-v2 --dry-run",
    "  mirai project migrate [path] --from graph-v2 --apply --approval <receipt>",
    "",
    "Alpha.3 effects are capability-gated. Workspace/process actions require --apply and a signed local approval.",
    ""
  ].join("\n"));
}

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  return args[index + 1];
}

function readOptions(args: string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) if (args[index] === name && args[index + 1]) values.push(args[index + 1] as string);
  return values;
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function writeProjectOutput(value: Record<string, unknown>, markdown: boolean): void {
  if (!markdown) return writeJson(value);
  const lines = ["# Mirai Project Report", ""];
  for (const [key, item] of Object.entries(value)) {
    if (Array.isArray(item)) lines.push(`- ${key}: ${item.length ? item.map((entry) => `\`${typeof entry === "string" ? entry : JSON.stringify(entry)}\``).join(", ") : "none"}`);
    else if (item && typeof item === "object") lines.push(`- ${key}: \`${JSON.stringify(item)}\``);
    else lines.push(`- ${key}: \`${String(item)}\``);
  }
  process.stdout.write(`${lines.join("\n")}\n`);
}

function requireArgument(value: string | undefined, label: string): string {
  if (!value) throw new Error(`Missing ${label}`);
  return value;
}

function loadProgram(filename: string) {
  return compileProgramFile(path.resolve(filename)).program;
}

function loadRuntimeProgram(filename: string): MiraiProgram {
  if (!filename.endsWith(".mirai.json")) throw new Error("Runtime accepts compiled .mirai.json IR only; run mirai compile first");
  return loadProgram(filename);
}

function loadJson(filename: string): Record<string, unknown> {
  const value = JSON.parse(fs.readFileSync(path.resolve(filename), "utf8")) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${filename} must contain a JSON object`);
  return value as Record<string, unknown>;
}

function writeJsonFile(filename: string, value: unknown, force = false): string {
  const target = path.resolve(filename);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, { flag: force ? "w" : "wx" });
  return target;
}

function loadRegistry(args: string[]): Record<string, MiraiProgram> {
  const result: Record<string, MiraiProgram> = {};
  for (const spec of readOptions(args, "--import")) {
    const separator = spec.indexOf("=");
    if (separator < 1 || separator === spec.length - 1) throw new Error(`Invalid --import ${spec}; expected alias=path`);
    const alias = spec.slice(0, separator);
    const program = loadProgram(spec.slice(separator + 1));
    result[alias] = program;
    result[program.id] = program;
  }
  return result;
}

function loadRuntimeRegistry(args: string[]): Record<string, MiraiProgram> {
  const result: Record<string, MiraiProgram> = {};
  for (const spec of readOptions(args, "--import")) {
    const separator = spec.indexOf("=");
    if (separator < 1 || separator === spec.length - 1) throw new Error(`Invalid --import ${spec}; expected alias=path`);
    const alias = spec.slice(0, separator);
    const program = loadRuntimeProgram(spec.slice(separator + 1));
    result[alias] = program;
    result[program.id] = program;
  }
  return result;
}

function runtimeHome(args: string[]): string | undefined {
  return readOption(args, "--home") || process.env.MIRAI_HOME;
}

function parseEffects(value: string): EffectName[] {
  const known = new Set<EffectName>(["repository_read", "git_read", "workspace_patch", "process_run", "human_approval"]);
  const effects = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (!effects.length || effects.some((item) => !known.has(item as EffectName))) throw new Error(`Invalid --effects ${value}`);
  return [...new Set(effects)] as EffectName[];
}

function runtimeConfig(args: string[]): {
  policy?: CapabilityPolicy;
  test_commands?: Record<string, TestCommandDefinition>;
  events?: Record<string, unknown>;
} {
  const filename = readOption(args, "--runtime-config");
  if (!filename) return {};
  const config = loadJson(filename);
  return {
    ...(config.policy ? { policy: config.policy as CapabilityPolicy } : {}),
    ...(config.test_commands ? { test_commands: config.test_commands as Record<string, TestCommandDefinition> } : {}),
    ...(config.events ? { events: config.events as Record<string, unknown> } : {})
  };
}

export async function runCli(args: string[]): Promise<number> {
  if (!args.length || args.includes("--help") || args.includes("-h")) {
    usage();
    return args.length ? 0 : 1;
  }

  try {
    if (args[0] === "project") {
      const command = requireArgument(args[1], "project command");
      const target = path.resolve(args[2] && !args[2].startsWith("--") ? args[2] : ".");
      if (command === "init") {
        writeJson(initProjectCapsule(target, readOption(args, "--profile") || "project_management", { title: readOption(args, "--title") }));
        return 0;
      }
      if (command === "detect" || command === "status") {
        const result = detectProjectCapsule(target);
        writeProjectOutput(result as unknown as Record<string, unknown>, args.includes("--markdown"));
        return result.status === "invalid" || result.status === "dual_root_conflict" ? 2 : 0;
      }
      if (command === "compile") {
        const result = compileProjectCapsule(target);
        writeJson({ status: "compiled", project_root: target, lock_digest: result.lock.digest, lock_path: result.lock_path, start_path: result.start_path, canonical_write_allowed: false });
        return 0;
      }
      if (command === "validate") {
        const result = validateProjectCapsule(target);
        writeJson(result);
        return result.valid ? 0 : 1;
      }
      if (command === "inspect") {
        if (!args.includes("--for-agent")) throw new Error("project inspect currently requires --for-agent");
        writeProjectOutput(inspectProjectForAgent(target, requireArgument(readOption(args, "--task"), "--task")) as unknown as Record<string, unknown>, args.includes("--markdown"));
        return 0;
      }
      if (command === "migrate") {
        if (readOption(args, "--from") !== "graph-v2") throw new Error("project migration requires --from graph-v2");
        if (args.includes("--rollback")) {
          const result = rollbackProjectMigration(target, requireArgument(readOption(args, "--approval"), "--approval receipt"));
          writeJson(result);
          return result.status === "rolled_back" ? 0 : 2;
        }
        if (args.includes("--dry-run")) {
          const result = planProjectMigration(target);
          writeJson(result);
          return result.status === "ready" || result.status === "already_current" ? 0 : 2;
        }
        if (!args.includes("--apply")) throw new Error("migration is dry-run by default; use --dry-run or explicit --apply --approval");
        const result = applyProjectMigration(target, requireArgument(readOption(args, "--approval"), "--approval receipt"));
        writeJson(result);
        return result.status === "applied" || result.status === "already_current" ? 0 : 2;
      }
      throw new Error(`Unknown project command ${command}`);
    }

    if (args[0] === "init") {
      const target = path.resolve(args[1] && !args[1].startsWith("--") ? args[1] : ".");
      writeJson(initProjectCapsule(target, readOption(args, "--profile") || "project_management", { title: readOption(args, "--title") }));
      return 0;
    }

    if (args[0] === "detect") {
      const target = path.resolve(args[1] && !args[1].startsWith("--") ? args[1] : ".");
      writeProjectOutput(detectProjectCapsule(target) as unknown as Record<string, unknown>, args.includes("--markdown"));
      return 0;
    }

    if (args[0] === "bootstrap") {
      const target = path.resolve(args[1] && !args[1].startsWith("--") ? args[1] : ".");
      const mode = readOption(args, "--mode") || "detect";
      if (mode === "detect") writeProjectOutput(detectProjectCapsule(target) as unknown as Record<string, unknown>, args.includes("--markdown"));
      else if (mode === "suggest") writeProjectOutput(createBootstrapProposal(target, readOption(args, "--profile") || "project_management") as unknown as Record<string, unknown>, args.includes("--markdown"));
      else throw new Error(`Unknown bootstrap mode ${mode}`);
      return 0;
    }

    if (args[0] === "source" && args[1] === "scan") {
      const catalog = scanSource(requireArgument(args[2], "source path"));
      const output = readOption(args, "--out");
      if (output) writeJson({ status: "catalog_written", output: writeJsonFile(output, catalog, args.includes("--force")), digest: catalog.digest, canonical_write_allowed: false });
      else writeJson(catalog);
      return catalog.diagnostics.some((item) => item.severity === "blocking") ? 2 : 0;
    }

    if (args[0] === "assimilate") {
      const catalog = loadJson(requireArgument(args[1], "source catalog")) as unknown as SourceCatalog;
      const proposal = assimilateCatalog(catalog);
      const output = requireArgument(readOption(args, "--out"), "--out path");
      writeJson({ status: proposal.quality.readiness, output: writeJsonFile(output, proposal, args.includes("--force")), digest: proposal.digest, canonical_write_allowed: false });
      return proposal.quality.readiness === "blocked" ? 2 : 0;
    }

    if (args[0] === "technology" && args[1] === "extract") {
      const draft = extractTechnologyFile(requireArgument(args[2], "technology source"));
      const output = requireArgument(readOption(args, "--out"), "--out path");
      writeJson({ status: draft.diagnostics.some((item) => item.severity === "blocking") ? "proposal_blocked" : "ready_for_compile", output: writeJsonFile(output, draft, args.includes("--force")), diagnostics: draft.diagnostics, canonical_write_allowed: false });
      return 0;
    }

    if (args[0] === "technology" && args[1] === "compile") {
      const draft = loadJson(requireArgument(args[2], "technology draft")) as unknown as TechnologyDraft;
      const program = compileTechnologyDraft(draft);
      const output = requireArgument(readOption(args, "--out"), "--out path");
      writeJson({ status: "compiled", output: writeJsonFile(output, program, args.includes("--force")), digest: program.digest, canonical_write_allowed: false });
      return 0;
    }

    if (args[0] === "technology" && args[1] === "qualify") {
      const draft = loadJson(requireArgument(args[2], "technology draft")) as unknown as TechnologyDraft;
      const bindingsValue = JSON.parse(fs.readFileSync(path.resolve(requireArgument(readOption(args, "--bindings"), "--bindings path")), "utf8")) as unknown;
      if (!Array.isArray(bindingsValue)) throw new Error("Qualification bindings must be a JSON array");
      const result = qualifyTechnologyDraft(draft, bindingsValue as OperationQualificationBinding[]);
      const output = requireArgument(readOption(args, "--out"), "--out path");
      writeJson({ status: result.status, output: writeJsonFile(output, result, args.includes("--force")), digest: result.digest, activation_allowed: result.activation_allowed, canonical_write_allowed: false });
      return result.status === "blocked" ? 2 : 0;
    }

    if (args[0] === "technology" && args[1] === "hybrid-compile") {
      const draft = loadJson(requireArgument(args[2], "technology draft")) as unknown as TechnologyDraft;
      const qualification = loadJson(requireArgument(readOption(args, "--qualification"), "--qualification path")) as unknown as TechnologyQualificationResult;
      const plan = compileHybridTechnologyPlan(draft, qualification);
      const output = requireArgument(readOption(args, "--out"), "--out path");
      writeJson({ status: plan.qualification_status, output: writeJsonFile(output, plan, args.includes("--force")), digest: plan.digest, activation_allowed: plan.activation_allowed, canonical_write_allowed: false });
      return 0;
    }

    if (args[0] === "component" && args[1] === "validate") {
      const result = validateComponentPackage(loadJson(requireArgument(args[2], "component package")) as unknown as ComponentPackage);
      writeJson(result);
      return result.valid ? 0 : 1;
    }

    if (args[0] === "activation" && args[1] === "plan") {
      const snapshot = loadJson(requireArgument(readOption(args, "--graph"), "--graph path")) as unknown as ActivationGraphSnapshot;
      const signal = loadJson(requireArgument(readOption(args, "--signal"), "--signal path")) as unknown as ActivationSignal;
      const join = (readOption(args, "--join") || "all") as JoinPolicy;
      if (!["all", "collect", "any_success_ordered", "quorum"].includes(join)) throw new Error(`Unknown join policy ${join}`);
      const plan = resolveActivationPlan(snapshot, signal, { join, ...(readOption(args, "--quorum") ? { quorum: Number(readOption(args, "--quorum")) } : {}) });
      const output = requireArgument(readOption(args, "--out"), "--out path");
      writeJson({ status: "planned", output: writeJsonFile(output, plan, args.includes("--force")), digest: plan.digest, canonical_write_allowed: false });
      return 0;
    }

    if (args[0] === "activation" && args[1] === "simulate") {
      const plan = loadJson(requireArgument(args[2], "activation plan")) as unknown as ActivationPlan;
      writeJson(simulateActivationPlan(plan));
      return 0;
    }

    if (args[0] === "activation" && args[1] === "run") {
      const plan = loadJson(requireArgument(args[2], "activation plan")) as unknown as ActivationPlan;
      const validation = validateActivationPlan(plan);
      if (!validation.valid) throw new Error(`activation_plan_invalid:${validation.errors.join(",")}`);
      const inputFile = readOption(args, "--input");
      const result = await runActivationPlan(plan, {
        sandbox: requireArgument(readOption(args, "--sandbox"), "--sandbox path"),
        home: runtimeHome(args),
        base_dir: readOption(args, "--base-dir") || process.cwd(),
        input: inputFile ? loadJson(inputFile) : {},
        apply: args.includes("--apply")
      });
      writeJson(result);
      return result.status === "completed" ? 0 : 2;
    }

    if (args[0] === "program" && args[1] === "validate") {
      const filename = requireArgument(args[2], "program path");
      const program = loadProgram(filename);
      writeJson({ valid: true, program_id: program.id, digest: program.digest, execution_performed: false });
      return 0;
    }

    if (args[0] === "compile") {
      const source = requireArgument(args[1], "source path");
      const output = requireArgument(readOption(args, "--out"), "--out path");
      const program = loadProgram(source);
      const target = path.resolve(output);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, `${JSON.stringify(program, null, 2)}\n`, { flag: args.includes("--force") ? "w" : "wx" });
      writeJson({ status: "compiled", source: path.resolve(source), output: target, digest: program.digest });
      return 0;
    }

    if (args[0] === "program" && args[1] === "plan") {
      writeJson(simulatePlan(loadProgram(requireArgument(args[2], "program path"))));
      return 0;
    }

    if (args[0] === "simulate") {
      const source = requireArgument(args[1], "program path");
      const inputFile = readOption(args, "--input");
      const eventsFile = readOption(args, "--events");
      const episode = await executePure(loadProgram(source), inputFile ? loadJson(inputFile) : {}, {
        programs: loadRegistry(args),
        events: eventsFile ? loadJson(eventsFile) : {}
      });
      writeJson(episode);
      return 0;
    }

    if (args[0] === "replay") {
      const episodeRef = requireArgument(args[1], "episode path or run id");
      const programFile = requireArgument(readOption(args, "--program"), "--program path");
      const episodePath = path.resolve(episodeRef);
      const rawEpisode = fs.existsSync(episodePath)
        ? loadJson(episodePath)
        : episodeRef.startsWith("run.")
          ? new RunStore(runtimeHome(args)).readEpisode(episodeRef) as unknown as Record<string, unknown>
          : loadJson(episodePath);
      const result = Array.isArray(rawEpisode.effect_stubs)
        ? await replayGovernedEpisode(rawEpisode as unknown as GovernedEpisode, loadRuntimeProgram(programFile), { programs: loadRuntimeRegistry(args) })
        : await replayPure(rawEpisode as unknown as PureEpisode, loadProgram(programFile), { programs: loadRegistry(args) });
      writeJson(result);
      return result.status === "match" ? 0 : 1;
    }

    if (args[0] === "conformance" && args[1] === "run") {
      const result = await runPureCorpus(requireArgument(args[2], "corpus path"));
      writeJson(result);
      return result.status === "passed" ? 0 : 1;
    }

    if (args[0] === "conformance" && args[1] === "compare") {
      const reference = loadJson(requireArgument(args[2], "reference result")) as unknown as ImplementationConformanceResult;
      const candidate = loadJson(requireArgument(args[3], "candidate result")) as unknown as ImplementationConformanceResult;
      const result = compareConformanceResults(reference, candidate);
      writeJson(result);
      return result.status === "match" ? 0 : 1;
    }

    if (args[0] === "approval" && args[1] === "create") {
      const program = loadRuntimeProgram(requireArgument(args[2], "program path"));
      const sandbox = requireArgument(readOption(args, "--sandbox"), "--sandbox path");
      const requestsPath = path.resolve(requireArgument(readOption(args, "--requests"), "--requests path"));
      const rawRequests = fs.statSync(requestsPath).isDirectory()
        ? fs.readdirSync(requestsPath).filter((name) => name.endsWith(".json")).sort().map((name) => loadJson(path.join(requestsPath, name)))
        : loadJson(requestsPath);
      const requests = (Array.isArray(rawRequests) ? rawRequests : [rawRequests]) as unknown as CapabilityRequest[];
      if (!requests.length) throw new Error("approval_requests_required");
      const requestScopes: ApprovalRequestScope[] = requests.map((request) => {
        const { contract_version: _contract, request_id: _requestId, request_digest: _requestDigest, approval_required: _approvalRequired, ...scope } = request;
        return scope;
      });
      const first = requests[0] as CapabilityRequest;
      if (requests.some((request) => request.program_digest !== program.digest)) throw new Error("approval_request_program_mismatch");
      const effects = [...new Set(requests.flatMap((request) => request.effects))];
      const output = path.resolve(requireArgument(readOption(args, "--out"), "--out path"));
      const receipt = createApprovalReceipt({
        home: runtimeHome(args) || path.join(process.env.HOME || process.cwd(), ".mirai"),
        run_id: first.run_id,
        program_digest: program.digest,
        input_digest: first.input_digest,
        policy_digest: first.policy_digest,
        sandbox,
        effects,
        request_scopes: requestScopes,
        approver: readOption(args, "--approver") || process.env.USER || "local-owner",
        ttl_ms: Number(readOption(args, "--ttl-ms") || 15 * 60 * 1000)
      });
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`, { flag: args.includes("--force") ? "w" : "wx", mode: 0o600 });
      writeJson({ status: "approval_created", approval_id: receipt.approval_id, output, expires_at: receipt.expires_at });
      return 0;
    }

    if (args[0] === "run") {
      const program = loadRuntimeProgram(requireArgument(args[1], "program path"));
      const inputFile = readOption(args, "--input");
      const approvalFile = readOption(args, "--approval");
      const config = runtimeConfig(args);
      const result = await startGovernedRun(program, inputFile ? loadJson(inputFile) : {}, {
        home: runtimeHome(args),
        sandbox: requireArgument(readOption(args, "--sandbox"), "--sandbox path"),
        apply: args.includes("--apply"),
        approval: approvalFile ? loadJson(approvalFile) as unknown as ApprovalReceipt : undefined,
        programs: loadRuntimeRegistry(args),
        policy: config.policy,
        test_commands: config.test_commands,
        events: config.events,
        run_id: readOption(args, "--run-id")
      });
      writeJson(result);
      return result.run.status === "completed" ? 0 : 2;
    }

    if (args[0] === "resume") {
      const approvalFile = readOption(args, "--approval");
      const result = await resumeGovernedRun(requireArgument(args[1], "run id"), {
        home: runtimeHome(args),
        approval: approvalFile ? loadJson(approvalFile) as unknown as ApprovalReceipt : undefined
      });
      writeJson(result);
      return result.run.status === "completed" ? 0 : 2;
    }

    if (args[0] === "cancel") {
      writeJson(cancelGovernedRun(requireArgument(args[1], "run id"), { home: runtimeHome(args) }));
      return 0;
    }

    if (args[0] === "reconcile") {
      const result = await reconcileGovernedRun(requireArgument(args[1], "run id"), { home: runtimeHome(args) });
      writeJson(result);
      return result.run.blockers.length ? 2 : 0;
    }

    if (args[0] === "inspect") {
      writeJson(inspectGovernedRun(requireArgument(args[1], "run id"), { home: runtimeHome(args) }));
      return 0;
    }

    if (args[0] === "operations" && args[1] === "status") {
      const result = inspectRuntimeHealth(runtimeHome(args));
      writeJson(result);
      return result.status === "blocked" ? 2 : 0;
    }

    if (args[0] === "evidence" && args[1] === "export") {
      const filename = exportSanitizedEvidence(
        requireArgument(args[2], "run id"),
        requireArgument(readOption(args, "--out"), "--out path"),
        { home: runtimeHome(args) }
      );
      writeJson({ status: "evidence_exported", output: filename, canonical_write_allowed: false });
      return 0;
    }

    if (args[0] === "migrate" && args.includes("--from")) {
      const target = requireArgument(args[1], "project or technology path");
      if (readOption(args, "--from") !== "1.4") throw new Error("Only --from 1.4 is supported");
      if (!args.includes("--dry-run")) throw new Error("Alpha.1 migration is dry-run only; pass --dry-run");
      const result = migrateTechnologyTarget(target, readOption(args, "--bindings"));
      writeJson(result);
      return result.status === "ready" ? 0 : 2;
    }

    usage();
    return 1;
  } catch (error) {
    if (error instanceof ProgramCompilationError) {
      writeJson({ valid: false, errors: error.validation.errors, execution_performed: false });
      return 1;
    }
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}
