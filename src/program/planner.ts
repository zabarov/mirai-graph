import type { MiraiProgram, ProgramNode } from "./types.js";
import { validateProgram } from "./validator.js";

function targets(node: ProgramNode): string[] {
  const result: string[] = [];
  if (node.next) result.push(node.next);
  if (node.kind === "branch") result.push(node.then, node.else);
  if (node.kind === "match") result.push(...node.cases.map((item) => item.to), node.default);
  if (node.kind === "await") result.push(node.on_timeout);
  if (node.kind === "retry") result.push(node.on_error);
  if (node.kind === "timeout") result.push(node.on_timeout);
  if (node.kind === "call" && node.on_error) result.push(node.on_error);
  if (node.kind === "compensate" && node.on_error) result.push(node.on_error);
  return [...new Set(result)];
}

export function simulatePlan(program: MiraiProgram): Record<string, unknown> {
  const validation = validateProgram(program);
  if (!validation.valid) return { status: "blocked", validation, canonical_write_allowed: false };
  const byId = new Map(program.nodes.map((node) => [node.id, node]));
  const queue = [program.entry];
  const visited: string[] = [];
  const effects = new Set<string>();
  while (queue.length) {
    const id = queue.shift() as string;
    if (visited.includes(id)) continue;
    const node = byId.get(id);
    if (!node) continue;
    visited.push(id);
    if (node.kind === "call") for (const effect of node.effects || []) effects.add(effect);
    queue.push(...targets(node).sort());
  }
  return {
    contract_version: "1.0.0",
    operation: "mirai.program.simulate_plan",
    status: "success",
    program_id: program.id,
    program_digest: program.digest,
    reachable_nodes: visited,
    declared_effects: [...effects].sort(),
    execution_performed: false,
    canonical_write_allowed: false,
    limitations: ["Static simulation explores possible control paths; it does not execute expressions or effects."]
  };
}
