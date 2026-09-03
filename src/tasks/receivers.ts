import { digestValue } from "../core/canonical.js";
import { validateProgram } from "../program/validator.js";
import { executePure } from "../runtime/pure-interpreter.js";
import { createStandardPureAdapters, standardOperationCatalogDigest } from "../stdlib/catalog.js";
import { requireCondition, requireJson } from "../stdlib/graph.js";
import type { MiraiProgram } from "../program/types.js";
import type { TaskReceiver, ProgramTaskReceiverOptions } from "./types.js";

/** Reference tasks are effect-free. External operations remain separate adapters. */
export function programTaskReceiver(options: ProgramTaskReceiverOptions): TaskReceiver {
  const program = structuredClone(options.program);
  const programs = structuredClone(options.programs || {});
  const evidenceId = options.evidence_id;
  requireJson({ program, programs });
  requireCondition(Object.keys(programs).length <= 64, "task_program_import_budget_exceeded");
  requireCondition(Object.entries(programs).every(([id, p]) => p && id === p.id && id !== program.id), "task_program_import_identity_invalid");
  const visiting = new Set<string>(), visited = new Set<string>();
  const checkedDepth = new Map<string, number>();
  const visit = (p: MiraiProgram, depth: number): void => {
    requireCondition(depth <= program.policies.budgets.max_depth, "task_program_import_depth_exceeded");
    requireCondition(!visiting.has(p.id), "task_program_import_cycle");
    if ((checkedDepth.get(p.id) ?? -1) >= depth) return;
    requireCondition(validateProgram(p).valid, "task_program_invalid");
    requireCondition(p.policies.allowed_effects.every(e => e === "pure"), "task_program_effect_not_supported");
    requireCondition(depth <= p.policies.budgets.max_depth, "task_program_import_depth_exceeded");
    checkedDepth.set(p.id, depth);
    visiting.add(p.id);
    for (const reference of p.imports) {
      const child = programs[reference.ref];
      requireCondition(child && child.digest === reference.digest, "task_program_import_missing_or_changed");
      // The legacy interpreter also resolves aliases from its global registry.
      requireCondition((reference.alias !== program.id || child.id === program.id) && (!programs[reference.alias] || programs[reference.alias]!.id === child.id), "task_program_import_alias_conflict");
      visit(child, depth + 1);
    }
    visiting.delete(p.id); visited.add(p.id);
  };
  requireCondition(validateProgram(program).valid, "task_program_invalid");
  visit(program, 0);
  requireCondition(Object.keys(programs).every(id => visited.has(id)), "task_program_import_unused");
  const bindings = Object.keys(programs).sort().map(id => ({ id, digest: programs[id]!.digest }));
  return {
    id: options.id, kind: "program", digest: digestValue({ program_digest: program.digest, evidence_id: evidenceId, catalog_digest: standardOperationCatalogDigest(), ...(bindings.length ? { imports: bindings } : {}) }),
    input_type: { kind: "record", fields: Object.fromEntries(program.inputs.map(s => [s.id, s.type])) },
    output_type: { kind: "record", fields: Object.fromEntries(program.outputs.map(s => [s.id, s.type])) },
    async execute(input, context) {
      requireCondition(!context.signal.aborted, "task_cancelled");
      const episode = await executePure(program, input, { programs, adapters: createStandardPureAdapters(standardOperationCatalogDigest()) });
      requireCondition(!context.signal.aborted, "task_cancelled");
      requireCondition(episode.status === "completed", "task_program_not_completed");
      return { output: episode.outputs, evidence: [{ id: evidenceId, digest: digestValue(episode) }] };
    }
  };
}
