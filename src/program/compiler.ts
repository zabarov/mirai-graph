import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { canonicalize } from "../core/canonical.js";
import { programDigest } from "./digest.js";
import { PROGRAM_CONTRACT_VERSION, type MiraiProgram, type ValidationResult } from "./types.js";
import { validateProgram } from "./validator.js";

export class ProgramCompilationError extends Error {
  constructor(public readonly validation: ValidationResult) {
    super(`Mirai Program compilation failed: ${validation.errors.join(", ")}`);
  }
}

function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, stripUndefined(item)]));
  }
  return value;
}

function sourceLine(source: string, id: string): number | undefined {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^\\s*(?:-\\s*)?id:\\s*["']?${escaped}["']?\\s*$`);
  const index = source.split(/\r?\n/).findIndex((line) => pattern.test(line));
  return index >= 0 ? index + 1 : undefined;
}

export function parseProgramSource(source: string, filename = "program.mirai.yaml"): Record<string, unknown> {
  if (filename.endsWith(".json")) return JSON.parse(source) as Record<string, unknown>;
  const document = YAML.parseDocument(source, { uniqueKeys: true, prettyErrors: true });
  if (document.errors.length) throw new Error(document.errors.map((error) => error.message).join("\n"));
  const value = document.toJS() as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Mirai Program source must be an object");
  return value as Record<string, unknown>;
}

export function compileProgramSource(source: string, filename = "program.mirai.yaml"): { program: MiraiProgram; validation: ValidationResult } {
  const parsed = parseProgramSource(source, filename);
  const suppliedDigest = typeof parsed.digest === "string" ? parsed.digest : undefined;
  const { digest: _ignoredDigest, ...sourceWithoutDigest } = parsed;
  const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
  const sourceMap = Object.fromEntries(nodes
    .filter((node): node is Record<string, unknown> => Boolean(node) && typeof node === "object" && !Array.isArray(node) && typeof (node as Record<string, unknown>).id === "string")
    .map((node) => {
      const line = sourceLine(source, String(node.id));
      return [String(node.id), line ? { file: filename, line } : { file: filename }];
    }));
  const candidate = stripUndefined({
    ...sourceWithoutDigest,
    contract_version: parsed.contract_version || PROGRAM_CONTRACT_VERSION,
    imports: parsed.imports || [],
    inputs: parsed.inputs || [],
    outputs: parsed.outputs || [],
    state: parsed.state || [],
    error_routes: parsed.error_routes || [],
    source_map: parsed.source_map || sourceMap
  }) as Omit<MiraiProgram, "digest">;
  const canonical = canonicalize(candidate) as Omit<MiraiProgram, "digest">;
  const program = { ...canonical, digest: programDigest(canonical) } as MiraiProgram;
  if (suppliedDigest && suppliedDigest !== program.digest) {
    throw new ProgramCompilationError({
      valid: false,
      errors: [`digest_mismatch:${suppliedDigest}:${program.digest}`],
      warnings: []
    });
  }
  const validation = validateProgram(program);
  if (!validation.valid) throw new ProgramCompilationError(validation);
  return { program, validation };
}

export function compileProgramFile(filename: string): { program: MiraiProgram; validation: ValidationResult } {
  const absolute = path.resolve(filename);
  return compileProgramSource(fs.readFileSync(absolute, "utf8"), path.basename(absolute));
}
