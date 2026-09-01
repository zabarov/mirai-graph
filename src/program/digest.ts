import { canonicalize, digestValue } from "../core/canonical.js";
import type { MiraiProgram } from "./types.js";

export function programDigestPayload(value: Omit<MiraiProgram, "digest"> | MiraiProgram): Record<string, unknown> {
  const { digest: _digest, source_map: _sourceMap, ...semanticProgram } = value as MiraiProgram;
  return canonicalize(semanticProgram) as Record<string, unknown>;
}

export function programDigest(value: Omit<MiraiProgram, "digest"> | MiraiProgram): string {
  return digestValue(programDigestPayload(value));
}
