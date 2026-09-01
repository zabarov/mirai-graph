import type { MiraiProgram } from "../program/types.js";
import { executePure, type PureEpisode, type PureExecutionOptions } from "./pure-interpreter.js";

export interface ReplayResult {
  contract_version: "1.0.0";
  status: "match" | "mismatch" | "blocked";
  program_digest_match: boolean;
  output_digest_match: boolean;
  trace_digest_match: boolean;
  replay_episode: PureEpisode | null;
  blockers: string[];
}

export async function replayPure(episode: PureEpisode, program: MiraiProgram, options: PureExecutionOptions = {}): Promise<ReplayResult> {
  if (episode.program_digest !== program.digest) {
    return {
      contract_version: "1.0.0", status: "blocked", program_digest_match: false,
      output_digest_match: false, trace_digest_match: false, replay_episode: null,
      blockers: ["program_digest_mismatch"]
    };
  }
  const replay = await executePure(program, episode.replay_input, options);
  const outputMatch = replay.output_digest === episode.output_digest;
  const traceMatch = replay.trace_digest === episode.trace_digest;
  return {
    contract_version: "1.0.0",
    status: outputMatch && traceMatch ? "match" : "mismatch",
    program_digest_match: true,
    output_digest_match: outputMatch,
    trace_digest_match: traceMatch,
    replay_episode: replay,
    blockers: []
  };
}
