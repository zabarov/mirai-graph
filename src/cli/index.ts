import fs from "node:fs";
import { runGraphOperationsCli } from "./graph-operations.js";
import { loadTaskCliAdapters, runTaskCli } from "./tasks.js";
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
  evaluateShadowDifferential,
  validateActivationPlan,
  type ActivationGraphSnapshot,
  type ActivationPlan,
  type ActivationSignal,
  type JoinPolicy,
  type ShadowAcceptedBaseline
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
import {
  buildSourceSnapshot,
  convertPayloads,
  createFilesystemSourceProvider,
  createGitSourceProvider,
  createHttpSourceProvider,
  diffSourceSnapshots,
  validateSourceDescriptor,
  type SourceDescriptor,
  type SourceProvider,
  type SourceSnapshot
} from "../sources/index.js";
import { organizeKnowledge, type KnowledgeOrganizationInput } from "../knowledge/index.js";
import {
  discoverProcessCandidates,
  observationsFromUnits,
  type ProcessObservation
} from "../technology/index.js";
import {
  applyAdaptiveEvolution,
  createAutonomyAuthorizationReceipt,
  evaluateEvolutionProposal,
  rollbackAdaptiveEvolution,
  validateAutonomyEnvelope,
  verifyAutonomyAuthorizationReceipt,
  type AutonomyAuthorizationReceipt,
  type AutonomyEnvelope,
  type EvolutionDecision,
  type EvolutionProposal,
  type PromotionReceipt
} from "../autonomy/index.js";
import { planAutonomicCycle, runAutonomicReconcileOnce, type AutonomicCycleInput } from "../evolution/index.js";
import { digestValue } from "../core/index.js";
import {
  buildLocalRetrievalIndex,
  collectRetrievalDocuments,
  inspectLocalRetrievalIndex,
  readRetrievalConfig,
  reconcileLocalRetrievalIndex,
  retrievalConfigurationDigest,
  searchLocalRetrievalIndex,
  type RetrievalRequest
} from "../retrieval/index.js";
import {
  assessOutcome,
  planOutcomeDelivery,
  proposeOutcomeTemplate,
  validateOutcomeContract,
  type OutcomeAssessment,
  type OutcomeCandidateSet,
  type OutcomeCompletionContract,
  type OutcomeEvidenceSet
} from "../outcome/index.js";

function usage(): void {
  process.stderr.write([
    "Mirai 2.1 CLI (stable)",
    "Mirai 2.5 Outcome Completion commands are in alpha development on the Mirai 2.4 stable baseline.",
    "Mirai 2.2 Autonomic Fabric commands are in development, bounded, proposal-first and never grant their own authority.",
    "Mirai 2.3 graph-operation development commands are read-only and proposal-only.",
    "",
    "  mirai stdlib list | describe <operation>",
    "  mirai graph query|traverse|project|diff|draft|validate|propose_patch <arguments.json>",
    "  mirai cluster propose|evaluate|materialize_view <arguments.json>",
    "  mirai task validate <registry.json>",
    "  mirai task inspect <run-id> --task-registry <registry.json> [--home <mirai-home>]",
    "  mirai program validate <program.mirai.yaml|program.mirai.json>",
    "  mirai compile <source.mirai.yaml> --out <program.mirai.json>",
    "  mirai program plan <program>",
    "  mirai simulate <program> [--input <input.json>] [--events <events.json>] [--import <alias=program>]",
    "  mirai replay <episode|run-id> --program <program> [--home <mirai-home>] [--import <alias=program>]",
    "  mirai conformance run <corpus.json>",
    "  mirai conformance compare <reference-result.json> <candidate-result.json>",
    "  mirai approval create <program.mirai.json> --sandbox <dir> --requests <requests.json> --out <receipt.json>",
    "  mirai run <program.mirai.json> --input <input.json> --sandbox <dir> [--apply --approval <receipt.json>] [--task-registry <registry.json>]",
    "  mirai resume <run-id> [--approval <receipt.json>] [--home <mirai-home>] [--task-registry <registry.json>]",
    "  mirai cancel <run-id> [--home <mirai-home>]",
    "  mirai reconcile <run-id> [--home <mirai-home>]",
    "  mirai inspect <run-id> [--home <mirai-home>]",
    "  mirai operations status [--home <mirai-home>]",
    "  mirai operations recover-mutation-lock <run-id> --confirm-stale-lock-recovery [--minimum-age-ms <ms>] [--home <mirai-home>]",
    "  mirai evidence export <run-id> --out <dir> [--home <mirai-home>]",
    "  mirai migrate <technology-or-project> --from 1.4 --dry-run [--bindings <bindings.json>]",
    "  mirai source scan <path> [--out <catalog.json>]",
    "  mirai source connect <descriptor.json>",
    "  mirai source snapshot <descriptor.json> --out <snapshot.json> [--previous <snapshot.json>] [--units-out <units.json>]",
    "  mirai source diff <previous.json> <current.json>",
    "  mirai assimilate <catalog.json> --out <proposal.json>",
    "  mirai assimilate reconcile <organization-input.json> --out <proposal.json>",
    "  mirai identity resolve <organization-input.json>",
    "  mirai technology extract <source> --out <draft.json>",
    "  mirai technology qualify <draft.json> --bindings <bindings.json> --out <qualification.json>",
    "  mirai technology hybrid-compile <draft.json> --qualification <qualification.json> --out <plan.json>",
    "  mirai technology compile <draft.json> --out <program.mirai.json>",
    "  mirai technology discover <observations-or-units.json> --out <candidates.json>",
    "  mirai autonomy validate <envelope.json> [--at <iso-time>]",
    "  mirai autonomy authorize <envelope.json> --approve --approved-by <owner> --out <receipt.json>",
    "  mirai evolution evaluate <proposal.json> --envelope <envelope.json> --out <decision.json>",
    "  mirai evolution apply <proposal.json> --decision <decision.json> --envelope <envelope.json> --authorization <receipt.json> --root <dir> --apply",
    "  mirai evolution rollback <promotion-receipt.json> --root <dir> --state-ref <path>",
    "  mirai autonomic reconcile --once --input <cycle-input.json> [--apply --authorization <receipt.json>]",
    "  mirai autonomic status [--root <dir>]",
    "  mirai component validate <component-package.json>",
    "  mirai activation plan --graph <snapshot.json> --signal <signal.json> --out <plan.json>",
    "  mirai activation simulate <plan.json>",
    "  mirai activation shadow <plan.json> --baseline <accepted-baseline.json> [--base-dir <dir>] --out <result.json>",
    "  mirai activation run <plan.json> --sandbox <dir> [--base-dir <dir>] [--input <input.json>] [--home <mirai-home>]",
    "  mirai project init [path] --profile <profile>",
    "  mirai project detect [path] [--json|--markdown]",
    "  mirai project compile [path]",
    "  mirai project validate [path]",
    "  mirai project inspect [path] --for-agent --task <task>",
    "  mirai project status [path]",
    "  mirai project migrate [path] --from graph-v2 --dry-run",
    "  mirai project migrate [path] --from graph-v2 --apply --approval <receipt>",
    "  mirai index plan <project>",
    "  mirai index build <project>",
    "  mirai index reconcile <project>",
    "  mirai index status|verify <project>",
    "  mirai search <project> <query> [--intent <intent>] [--markdown]",
    "  mirai search explain <project> <query> [--intent <intent>] [--markdown]",
    "  mirai outcome validate <contract.json>",
    "  mirai outcome assess --contract <contract.json> --candidates <candidates.json> --evidence <evidence.json>",
    "  mirai outcome explain <assessment.json> --markdown",
    "  mirai outcome template propose --intent <intent.json> --out <proposal.json>",
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

function loadJsonValue(filename: string): unknown {
  return JSON.parse(fs.readFileSync(path.resolve(filename), "utf8")) as unknown;
}

function sourceProvider(descriptor: SourceDescriptor): SourceProvider {
  if (descriptor.provider === "filesystem") return createFilesystemSourceProvider();
  if (descriptor.provider === "git") return createGitSourceProvider();
  if (descriptor.provider === "http") return createHttpSourceProvider();
  throw new Error(`source_provider_requires_optional_adapter:${descriptor.provider}`);
}

function autonomyHome(args: string[]): string {
  return path.resolve(runtimeHome(args) || path.join(process.env.HOME || process.cwd(), ".mirai"));
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
    if (args[0] === "task") return runTaskCli(args);
    if (["stdlib", "graph", "cluster"].includes(args[0] || "") || (args[0] === "component" && ["describe", "resolve"].includes(args[1] || ""))) return runGraphOperationsCli(args);
    if (args[0] === "outcome") {
      const command = requireArgument(args[1], "outcome command");
      if (command === "validate") {
        const contract = loadJson(requireArgument(args[2], "contract path")) as unknown as OutcomeCompletionContract;
        const result = validateOutcomeContract(contract);
        writeJson(result);
        return result.valid ? 0 : 1;
      }
      if (command === "assess") {
        const contract = loadJson(requireArgument(readOption(args, "--contract"), "--contract")) as unknown as OutcomeCompletionContract;
        const candidates = loadJson(requireArgument(readOption(args, "--candidates"), "--candidates")) as unknown as OutcomeCandidateSet;
        const evidence = loadJson(requireArgument(readOption(args, "--evidence"), "--evidence")) as unknown as OutcomeEvidenceSet;
        const assessment = assessOutcome(contract, candidates, evidence);
        writeJson(assessment);
        return ["satisfied", "partially_satisfied", "needs_input", "handoff_required"].includes(assessment.status) ? 0 : 2;
      }
      if (command === "explain") {
        const assessment = loadJson(requireArgument(args[2], "assessment path")) as unknown as OutcomeAssessment;
        const plan = planOutcomeDelivery(assessment, readOption(args, "--handoff") || null);
        if (!args.includes("--markdown")) writeJson(plan);
        else process.stdout.write(["# Outcome Completion", "", `- Status: \`${plan.status}\``, `- Assessment: \`${plan.assessment_digest}\``, `- Confirmed facts: ${plan.confirmed_facts.length}`, `- Gaps: ${plan.gaps.length}`, `- Next safe action: ${plan.useful_next_step}`, ...(plan.question ? [`- Question: ${plan.question}`] : []), "", "No execution, approval, capability or canonical write is authorized by this plan.", ""].join("\n"));
        return 0;
      }
      if (command === "template" && args[2] === "propose") {
        const intent = loadJson(requireArgument(readOption(args, "--intent"), "--intent"));
        const proposal = proposeOutcomeTemplate(intent);
        const output = readOption(args, "--out");
        if (output) writeJson({ status: "proposed", output: writeJsonFile(output, proposal, args.includes("--force")), proposal_digest: proposal.digest, canonical_write_allowed: false });
        else writeJson(proposal);
        return 0;
      }
      throw new Error(`Unknown outcome command ${args.slice(1).join(" ")}`);
    }
    if (args[0] === "index") {
      const command = requireArgument(args[1], "index command");
      const target = path.resolve(requireArgument(args[2], "project path"));
      if (command === "plan") {
        const config = readRetrievalConfig(target);
        const collected = collectRetrievalDocuments(target, config);
        writeJson({ status: "planned", project_id: config.project_id, index_id: config.index_id, document_count: collected.documents.length, source_snapshot_digests: collected.snapshotDigests, graph_snapshot_digest: collected.graph?.digest || null, configuration_digest: retrievalConfigurationDigest(config), writes_performed: false, canonical_write_allowed: false });
        return 0;
      }
      if (command === "build") {
        writeJson({ status: "built", descriptor: await buildLocalRetrievalIndex(target), canonical_write_allowed: false });
        return 0;
      }
      if (command === "reconcile") {
        writeJson({ status: "reconciled", ...(await reconcileLocalRetrievalIndex(target)), canonical_write_allowed: false });
        return 0;
      }
      if (command === "status" || command === "verify") {
        const result = inspectLocalRetrievalIndex(target);
        writeJson(result);
        return result.status === "ready" ? 0 : command === "status" && result.status === "missing" ? 0 : 2;
      }
      throw new Error(`Unknown index command ${command}`);
    }

    if (args[0] === "search") {
      const explain = args[1] === "explain";
      const offset = explain ? 1 : 0;
      const target = path.resolve(requireArgument(args[1 + offset], "project path"));
      const query = requireArgument(args[2 + offset], "query");
      const config = readRetrievalConfig(target);
      const collected = collectRetrievalDocuments(target, config);
      const requestBody = {
        contract_version: "1.0.0" as const,
        id: `query-${digestValue({ query, access: config.access }).slice(0, 16)}`,
        query,
        ...(readOption(args, "--intent") ? { intent: readOption(args, "--intent") as RetrievalRequest["intent"] } : {}),
        access: config.access,
        ...(readOption(args, "--freshness") ? { freshness_required: readOption(args, "--freshness") as RetrievalRequest["freshness_required"] } : {}),
        ...(readOption(args, "--max-results") ? { max_results: Number(readOption(args, "--max-results")) } : {}),
        ...(collected.graph ? { graph: collected.graph } : {}),
        canonical_write_allowed: false as const
      };
      const result = await searchLocalRetrievalIndex(target, requestBody);
      writeProjectOutput((explain ? result : result.answer) as unknown as Record<string, unknown>, args.includes("--markdown"));
      return result.answer.status === "clarification_required" || result.answer.status === "insufficient_evidence" ? 2 : 0;
    }
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
        const task = requireArgument(readOption(args, "--task"), "--task");
        const brief = inspectProjectForAgent(target, task);
        const retrievalConfig = path.join(target, "mirai", "retrieval.yaml");
        if (fs.existsSync(retrievalConfig)) {
          const state = inspectLocalRetrievalIndex(target);
          let retrieval;
          if (state.status === "ready" && state.descriptor) {
            const config = readRetrievalConfig(target);
            const collected = collectRetrievalDocuments(target, config);
            const result = await searchLocalRetrievalIndex(target, { contract_version: "1.0.0", id: `agent-${digestValue(task).slice(7, 23)}`, query: task, access: config.access, ...(collected.graph ? { graph: collected.graph } : {}), canonical_write_allowed: false });
            retrieval = { status: result.answer.status === "answered" ? "ready" as const : "partial" as const, index_digest: state.descriptor.digest, source_refs: result.evidence.source_refs, program_candidates: result.answer.program_candidates, policy_refs: result.answer.policy_refs, blockers: result.answer.conflicts, next_safe_action: result.answer.next_safe_action, evidence_bundle_digest: result.evidence.digest };
          } else {
            retrieval = { status: "unavailable" as const, index_digest: state.descriptor?.digest || null, source_refs: [], program_candidates: [], policy_refs: [], blockers: state.diagnostics, next_safe_action: state.status === "missing" ? "build_authorized_retrieval_index" : "reconcile_authorized_retrieval_index", evidence_bundle_digest: null };
          }
          const { digest: _digest, ...body } = brief;
          const enriched = { ...body, retrieval };
          writeProjectOutput({ ...enriched, digest: digestValue(enriched) } as unknown as Record<string, unknown>, args.includes("--markdown"));
        } else writeProjectOutput(brief as unknown as Record<string, unknown>, args.includes("--markdown"));
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

    if (args[0] === "source" && args[1] === "connect") {
      const descriptor = loadJson(requireArgument(args[2], "source descriptor")) as unknown as SourceDescriptor;
      const errors = validateSourceDescriptor(descriptor);
      writeJson({ valid: errors.length === 0, errors, source_id: descriptor.id, provider: descriptor.provider, connection_ref: descriptor.connection_ref || null, read_only: descriptor.read_only === true, credentials_persisted: false, canonical_write_allowed: false });
      return errors.length ? 1 : 0;
    }

    if (args[0] === "source" && args[1] === "snapshot") {
      const descriptor = loadJson(requireArgument(args[2], "source descriptor")) as unknown as SourceDescriptor;
      const errors = validateSourceDescriptor(descriptor);
      if (errors.length) throw new Error(`source_descriptor_invalid:${errors.join(",")}`);
      const provider = sourceProvider(descriptor);
      const sourceBudget = {
        max_items: Number(readOption(args, "--max-items") || 10_000),
        max_item_bytes: Number(readOption(args, "--max-item-bytes") || 8 * 1024 * 1024),
        max_total_bytes: Number(readOption(args, "--max-total-bytes") || 128 * 1024 * 1024),
        timeout_ms: Number(readOption(args, "--timeout-ms") || 30_000)
      };
      const payloads = await provider.scan(descriptor, sourceBudget);
      const previousRef = readOption(args, "--previous");
      const previous = previousRef ? loadJson(previousRef) as unknown as SourceSnapshot : undefined;
      const snapshot = buildSourceSnapshot(descriptor, payloads, previous, sourceBudget);
      const output = requireArgument(readOption(args, "--out"), "--out path");
      const unitsOutput = readOption(args, "--units-out");
      const conversion = unitsOutput ? await convertPayloads(snapshot, payloads, snapshot.budgets) : undefined;
      writeJson({
        status: conversion?.diagnostics.some((item) => item.severity === "blocking") ? "conversion_blocked" : "snapshotted",
        output: writeJsonFile(output, snapshot, args.includes("--force")),
        ...(unitsOutput && conversion ? { units_output: writeJsonFile(unitsOutput, conversion, args.includes("--force")), unit_count: conversion.units.length, diagnostics: conversion.diagnostics } : {}),
        digest: snapshot.digest,
        canonical_write_allowed: false
      });
      return conversion?.diagnostics.some((item) => item.severity === "blocking") ? 2 : 0;
    }

    if (args[0] === "source" && args[1] === "diff") {
      const previous = loadJson(requireArgument(args[2], "previous source snapshot")) as unknown as SourceSnapshot;
      const current = loadJson(requireArgument(args[3], "current source snapshot")) as unknown as SourceSnapshot;
      writeJson({ source_id: current.source.id, changes: diffSourceSnapshots(previous, current), canonical_write_allowed: false });
      return 0;
    }

    if (args[0] === "source" && args[1] === "scan") {
      const catalog = scanSource(requireArgument(args[2], "source path"));
      const output = readOption(args, "--out");
      if (output) writeJson({ status: "catalog_written", output: writeJsonFile(output, catalog, args.includes("--force")), digest: catalog.digest, canonical_write_allowed: false });
      else writeJson(catalog);
      return catalog.diagnostics.some((item) => item.severity === "blocking") ? 2 : 0;
    }

    if (args[0] === "assimilate" && args[1] === "reconcile") {
      const input = loadJson(requireArgument(args[2], "knowledge organization input")) as unknown as KnowledgeOrganizationInput;
      const proposal = organizeKnowledge(input);
      const output = requireArgument(readOption(args, "--out"), "--out path");
      writeJson({ status: proposal.quality.readiness, output: writeJsonFile(output, proposal, args.includes("--force")), digest: proposal.digest, next_safe_action: proposal.next_safe_action, canonical_write_allowed: false });
      return proposal.quality.readiness === "blocked" ? 2 : 0;
    }

    if (args[0] === "identity" && args[1] === "resolve") {
      const input = loadJson(requireArgument(args[2], "knowledge organization input")) as unknown as KnowledgeOrganizationInput;
      const proposal = organizeKnowledge(input);
      writeJson({ identity_resolutions: proposal.identity_resolutions, conflicts: proposal.conflicts, owner_review_required: proposal.identity_resolutions.some((item) => item.owner_review_required), canonical_write_allowed: false });
      return proposal.identity_resolutions.some((item) => item.resolution === "ambiguous") ? 2 : 0;
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

    if (args[0] === "technology" && args[1] === "discover") {
      const value = loadJsonValue(requireArgument(args[2], "observations or normalized units"));
      const observations = Array.isArray(value)
        ? value as ProcessObservation[]
        : value && typeof value === "object" && Array.isArray((value as Record<string, unknown>).observations)
          ? (value as { observations: ProcessObservation[] }).observations
          : value && typeof value === "object" && Array.isArray((value as Record<string, unknown>).units)
            ? observationsFromUnits((value as { units: Parameters<typeof observationsFromUnits>[0] }).units, { mode: (readOption(args, "--mode") || "observed") as "intended" | "observed", process_hint: readOption(args, "--process-hint") })
            : (() => { throw new Error("technology_discovery_input_invalid"); })();
      const candidates = discoverProcessCandidates(observations);
      const result = { contract_version: "1.0.0", observations, candidates, intended_and_observed_separated: true, canonical_write_allowed: false };
      const output = requireArgument(readOption(args, "--out"), "--out path");
      writeJson({ status: candidates.some((item) => item.diagnostics.some((diagnostic) => diagnostic.severity === "blocking")) ? "review_required" : "candidates_ready", output: writeJsonFile(output, result, args.includes("--force")), candidate_count: candidates.length, canonical_write_allowed: false });
      return 0;
    }

    if (args[0] === "autonomy" && args[1] === "validate") {
      const envelope = loadJson(requireArgument(args[2], "autonomy envelope")) as unknown as AutonomyEnvelope;
      const errors = validateAutonomyEnvelope(envelope, readOption(args, "--at") || new Date().toISOString());
      writeJson({ valid: errors.length === 0, errors, envelope_id: envelope.id, digest: envelope.digest, canonical_write_allowed: false });
      return errors.length ? 1 : 0;
    }

    if (args[0] === "autonomy" && args[1] === "authorize") {
      if (!args.includes("--approve")) throw new Error("autonomy_authorization_requires_explicit_--approve");
      const envelope = loadJson(requireArgument(args[2], "autonomy envelope")) as unknown as AutonomyEnvelope;
      const errors = validateAutonomyEnvelope(envelope, new Date().toISOString());
      if (errors.length) throw new Error(`autonomy_envelope_invalid:${errors.join(",")}`);
      const receipt = createAutonomyAuthorizationReceipt({ home: autonomyHome(args), envelope, approved_by: requireArgument(readOption(args, "--approved-by"), "--approved-by"), ttl_ms: Number(readOption(args, "--ttl-ms") || 24 * 60 * 60 * 1000) });
      const output = requireArgument(readOption(args, "--out"), "--out path");
      writeJson({ status: "authorized", output: writeJsonFile(output, receipt, args.includes("--force")), authorization_id: receipt.id, expires_at: receipt.expires_at, canonical_write_allowed: false });
      return 0;
    }

    if (args[0] === "evolution" && args[1] === "evaluate") {
      const proposal = loadJson(requireArgument(args[2], "evolution proposal")) as unknown as EvolutionProposal;
      const envelope = loadJson(requireArgument(readOption(args, "--envelope"), "--envelope path")) as unknown as AutonomyEnvelope;
      const decision = evaluateEvolutionProposal(proposal, envelope, readOption(args, "--at") || new Date().toISOString());
      const output = requireArgument(readOption(args, "--out"), "--out path");
      writeJson({ verdict: decision.verdict, output: writeJsonFile(output, decision, args.includes("--force")), digest: decision.digest, canonical_write_allowed: false });
      return decision.verdict === "denied" ? 2 : 0;
    }

    if (args[0] === "evolution" && args[1] === "apply") {
      if (!args.includes("--apply")) throw new Error("evolution_apply_requires_explicit_--apply");
      const proposal = loadJson(requireArgument(args[2], "evolution proposal")) as unknown as EvolutionProposal;
      const decision = loadJson(requireArgument(readOption(args, "--decision"), "--decision path")) as unknown as EvolutionDecision;
      const envelope = loadJson(requireArgument(readOption(args, "--envelope"), "--envelope path")) as unknown as AutonomyEnvelope;
      const receipt = loadJson(requireArgument(readOption(args, "--authorization"), "--authorization path")) as unknown as AutonomyAuthorizationReceipt;
      const home = autonomyHome(args);
      const root = path.resolve(requireArgument(readOption(args, "--root"), "--root path"));
      const promotion = applyAdaptiveEvolution({
        root,
        state_ref: readOption(args, "--state-ref") || ".mirai/adaptive/state.json",
        proposal,
        decision,
        envelope,
        authorization_ref: receipt.id,
        verify_authorization: () => verifyAutonomyAuthorizationReceipt(receipt, { home, envelope }).valid,
        applied_at: readOption(args, "--at") || new Date().toISOString()
      });
      const output = readOption(args, "--out");
      writeJson({ ...promotion, ...(output ? { receipt_output: writeJsonFile(output, promotion, args.includes("--force")) } : {}) });
      return 0;
    }

    if (args[0] === "evolution" && args[1] === "rollback") {
      if (!args.includes("--apply")) throw new Error("evolution_rollback_requires_explicit_--apply");
      const receipt = loadJson(requireArgument(args[2], "promotion receipt")) as unknown as PromotionReceipt;
      const result = rollbackAdaptiveEvolution({ root: path.resolve(requireArgument(readOption(args, "--root"), "--root path")), state_ref: requireArgument(readOption(args, "--state-ref"), "--state-ref"), receipt, rolled_back_at: readOption(args, "--at") || new Date().toISOString() });
      writeJson(result);
      return 0;
    }

    if (args[0] === "autonomic" && args[1] === "reconcile") {
      if (!args.includes("--once")) throw new Error("autonomic_reconcile_requires_--once");
      const input = loadJson(requireArgument(readOption(args, "--input"), "--input path")) as unknown as AutonomicCycleInput;
      if (!args.includes("--apply")) {
        writeJson(planAutonomicCycle(input));
        return 0;
      }
      const envelope = input.envelope;
      if (!envelope) throw new Error("autonomic_apply_requires_envelope");
      const authorization = loadJson(requireArgument(readOption(args, "--authorization"), "--authorization path")) as unknown as AutonomyAuthorizationReceipt;
      const home = autonomyHome(args);
      const result = runAutonomicReconcileOnce(input, {
        apply: true,
        root: path.resolve(readOption(args, "--root") || "."),
        state_ref: readOption(args, "--state-ref") || ".mirai/adaptive/state.json",
        authorization_ref: authorization.id,
        verify_authorization: () => verifyAutonomyAuthorizationReceipt(authorization, { home, envelope }).valid
      });
      writeJson(result);
      return result.status === "applied" ? 0 : 2;
    }

    if (args[0] === "autonomic" && args[1] === "status") {
      const root = path.resolve(readOption(args, "--root") || ".");
      const stateRef = readOption(args, "--state-ref") || ".mirai/adaptive/state.json";
      const filename = path.resolve(root, stateRef);
      if (!filename.startsWith(`${root}${path.sep}`)) throw new Error("autonomic_state_outside_root");
      writeJson(fs.existsSync(filename) ? { status: "available", state_ref: stateRef, state: loadJson(filename), canonical_write_allowed: false } : { status: "not_initialized", state_ref: stateRef, canonical_write_allowed: false });
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

    if (args[0] === "activation" && args[1] === "shadow") {
      const plan = loadJson(requireArgument(args[2], "activation plan")) as unknown as ActivationPlan;
      const baseline = loadJson(requireArgument(readOption(args, "--baseline"), "--baseline path")) as unknown as ShadowAcceptedBaseline;
      const result = evaluateShadowDifferential(baseline, plan, { base_dir: readOption(args, "--base-dir") || process.cwd() });
      const output = requireArgument(readOption(args, "--out"), "--out path");
      writeJson({ verdict: result.verdict, output: writeJsonFile(output, result, args.includes("--force")), digest: result.digest, zero_write_proven: true, activation_allowed: false, canonical_write_allowed: false });
      return result.verdict === "passed" ? 0 : 2;
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
        : loadJsonValue(requestsPath);
      if (!rawRequests || (Array.isArray(rawRequests) && rawRequests.some(request => !request || typeof request !== "object" || Array.isArray(request))) || (!Array.isArray(rawRequests) && typeof rawRequests !== "object")) throw new Error("approval_requests_invalid");
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
        run_id: readOption(args, "--run-id"),
        adapters: loadTaskCliAdapters(args)
      });
      writeJson(result);
      return result.run.status === "completed" ? 0 : 2;
    }

    if (args[0] === "resume") {
      const approvalFile = readOption(args, "--approval");
      const result = await resumeGovernedRun(requireArgument(args[1], "run id"), {
        home: runtimeHome(args),
        approval: approvalFile ? loadJson(approvalFile) as unknown as ApprovalReceipt : undefined,
        adapters: loadTaskCliAdapters(args)
      });
      writeJson(result);
      return result.run.status === "completed" ? 0 : 2;
    }

    if (args[0] === "cancel") {
      writeJson(cancelGovernedRun(requireArgument(args[1], "run id"), { home: runtimeHome(args) }));
      return 0;
    }

    if (args[0] === "reconcile") {
      const result = await reconcileGovernedRun(requireArgument(args[1], "run id"), { home: runtimeHome(args), adapters: loadTaskCliAdapters(args) });
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

    if (args[0] === "operations" && args[1] === "recover-mutation-lock") {
      if (!args.includes("--confirm-stale-lock-recovery")) throw new Error("mutation_lock_recovery_confirmation_required");
      const minimumAge = Number(readOption(args, "--minimum-age-ms") || "30000");
      const store = new RunStore(runtimeHome(args));
      const recoveryId = store.recoverStaleMutationLock(requireArgument(args[2], "run id"), { minimum_age_ms: minimumAge });
      writeJson({ status: "mutation_lock_recovered", run_id: args[2], recovery_id: recoveryId, canonical_write_allowed: false });
      return 0;
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
