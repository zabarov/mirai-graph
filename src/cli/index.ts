import fs from "node:fs";
import path from "node:path";
import { compileProgramFile, ProgramCompilationError } from "../program/compiler.js";
import { migrateTechnologyTarget } from "../program/migration.js";
import { simulatePlan } from "../program/planner.js";
import type { MiraiProgram } from "../program/types.js";
import { executePure, type PureEpisode } from "../runtime/pure-interpreter.js";
import { replayPure } from "../runtime/replay.js";
import { runPureCorpus } from "../conformance/pure-corpus.js";

function usage(): void {
  process.stderr.write([
    "Mirai 2 CLI (alpha.2)",
    "",
    "  mirai program validate <program.mirai.yaml|program.mirai.json>",
    "  mirai compile <source.mirai.yaml> --out <program.mirai.json>",
    "  mirai program plan <program>",
    "  mirai simulate <program> [--input <input.json>] [--events <events.json>] [--import <alias=program>]",
    "  mirai replay <episode> --program <program> [--import <alias=program>]",
    "  mirai conformance run <corpus.json>",
    "  mirai migrate <technology-or-project> --from 1.4 --dry-run [--bindings <bindings.json>]",
    "",
    "Alpha.2 executes deterministic pure programs only. External effects remain unavailable.",
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

function requireArgument(value: string | undefined, label: string): string {
  if (!value) throw new Error(`Missing ${label}`);
  return value;
}

function loadProgram(filename: string) {
  return compileProgramFile(path.resolve(filename)).program;
}

function loadJson(filename: string): Record<string, unknown> {
  const value = JSON.parse(fs.readFileSync(path.resolve(filename), "utf8")) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${filename} must contain a JSON object`);
  return value as Record<string, unknown>;
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

export async function runCli(args: string[]): Promise<number> {
  if (!args.length || args.includes("--help") || args.includes("-h")) {
    usage();
    return args.length ? 0 : 1;
  }

  try {
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
      const episodeFile = requireArgument(args[1], "episode path");
      const programFile = requireArgument(readOption(args, "--program"), "--program path");
      const episode = loadJson(episodeFile) as unknown as PureEpisode;
      const result = await replayPure(episode, loadProgram(programFile), { programs: loadRegistry(args) });
      writeJson(result);
      return result.status === "match" ? 0 : 1;
    }

    if (args[0] === "conformance" && args[1] === "run") {
      const result = await runPureCorpus(requireArgument(args[2], "corpus path"));
      writeJson(result);
      return result.status === "passed" ? 0 : 1;
    }

    if (args[0] === "migrate" && args.includes("--from")) {
      const target = requireArgument(args[1], "project or technology path");
      if (readOption(args, "--from") !== "1.4") throw new Error("Only --from 1.4 is supported");
      if (!args.includes("--dry-run")) throw new Error("Alpha.1 migration is dry-run only; pass --dry-run");
      const result = migrateTechnologyTarget(target, readOption(args, "--bindings"));
      writeJson(result);
      return result.status === "ready" ? 0 : 2;
    }

    if (["run", "resume", "cancel", "inspect", "evidence"].includes(args[0] as string)) {
      throw new Error(`${args[0]} is not available in 2.0.0-alpha.2; only pure simulation is implemented`);
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
