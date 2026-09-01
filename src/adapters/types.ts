import type { ApprovalReceipt, EffectName, EffectReceipt } from "../runtime/contracts.js";
import type { RunStore } from "../runtime/store.js";

export interface TestCommandDefinition {
  command: string;
  args: string[];
  timeout_ms: number;
  max_output_bytes: number;
}

export interface AdapterExecutionContext {
  run_id: string;
  sandbox: string;
  idempotency_key: string;
  max_bytes: number;
  deadline_at_ms?: number;
  remaining_ms?: number;
  signal?: AbortSignal;
  store: RunStore;
  approval?: ApprovalReceipt;
  test_commands: Record<string, TestCommandDefinition>;
}

export interface AdapterOperation {
  effect: EffectName;
  execute(args: Record<string, unknown>, context: AdapterExecutionContext): Promise<unknown>;
  verify(receipt: EffectReceipt, context: AdapterExecutionContext): Promise<{ verified: boolean; details: string[] }>;
  compensate?(receipt: EffectReceipt, context: AdapterExecutionContext): Promise<{ compensated: boolean; details: string[] }>;
}

export type AdapterRegistry = Record<string, Record<string, AdapterOperation>>;
