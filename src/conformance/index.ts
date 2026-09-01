import type { MiraiProgram, ValidationResult } from "../program/types.js";
import { validateProgram } from "../program/validator.js";

export const CONFORMANCE_CONTRACT_VERSION = "1.0.0" as const;

export interface ProgramConformanceResult extends ValidationResult {
  contract_version: typeof CONFORMANCE_CONTRACT_VERSION;
  subject: "mirai_program";
  program_id: string;
  program_digest: string;
}

export function checkProgramConformance(program: MiraiProgram): ProgramConformanceResult {
  const result = validateProgram(program);
  return {
    contract_version: CONFORMANCE_CONTRACT_VERSION,
    subject: "mirai_program",
    program_id: program.id,
    program_digest: program.digest,
    ...result
  };
}

export * from "./pure-corpus.js";
