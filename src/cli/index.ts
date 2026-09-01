import fs from "node:fs";
import path from "node:path";
import { compileProgramFile, ProgramCompilationError } from "../program/compiler.js";
import { migrateTechnologyTarget } from "../program/migration.js";
import { simulatePlan } from "../program/planner.js";

function usage(): void {
  process.stderr.write([
    "Mirai 2 CLI (alpha.1)",
    "",
    "  mirai program validate <program.mirai.yaml|program.mirai.json>",
    "  mirai compile <source.mirai.yaml> --out <program.mirai.json>",
    "  mirai simulate <program> [--input <input.json>]",
    "  mirai migrate <technology-or-project> --from 1.4 --dry-run [--bindings <bindings.json>]",
    "",
    "Execution commands become available in later release stages. Alpha.1 never executes effects.",
    ""
  ].join("\n"));
}

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  return args[index + 1];
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

    if (args[0] === "simulate") {
      const source = requireArgument(args[1], "program path");
      const inputFile = readOption(args, "--input");
      if (inputFile) JSON.parse(fs.readFileSync(path.resolve(inputFile), "utf8"));
      writeJson({ ...simulatePlan(loadProgram(source)), input_validated: Boolean(inputFile) });
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

    if (["run", "resume", "cancel", "inspect", "replay", "evidence"].includes(args[0] as string)) {
      throw new Error(`${args[0]} is not available in 2.0.0-alpha.1; no effects were executed`);
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
