import YAML from "yaml";
import type { SourceKind } from "./types.js";

export interface ParsedCandidate {
  local_ref: string;
  kind: "object" | "relation";
  semantic_type: string;
  label: string;
  confidence: number;
}

function safeLabel(value: unknown): string {
  const label = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
  return /(?:token|password|secret|private[_ -]?key|api[_ -]?key)/i.test(label) ? "[redacted-sensitive-label]" : label;
}

function structuredCandidates(value: unknown): ParsedCandidate[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  const result: ParsedCandidate[] = [];
  for (const [collection, kind] of [["objects", "object"], ["relations", "relation"]] as const) {
    const values = record[collection];
    if (!Array.isArray(values)) continue;
    values.forEach((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return;
      const entry = item as Record<string, unknown>;
      const identity = safeLabel(entry.id || `${collection}.${index + 1}`);
      result.push({
        local_ref: identity,
        kind,
        semantic_type: safeLabel(entry.kind || entry.type || (kind === "object" ? "graph_object" : "graph_relation")),
        label: safeLabel(entry.title || entry.label || entry.id || identity),
        confidence: 1
      });
    });
  }
  return result;
}

export function parseSourceCandidates(content: string, kind: SourceKind): { provider: string; version: string; candidates: ParsedCandidate[] } {
  if (kind === "markdown") {
    const candidates = [...content.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((match, index) => ({
      local_ref: `heading.${index + 1}`,
      kind: "object" as const,
      semantic_type: "knowledge_section",
      label: safeLabel(match[2]),
      confidence: 0.9
    }));
    return { provider: "mirai.markdown-headings", version: "1.0.0", candidates };
  }
  if (kind === "json" || kind === "yaml") {
    try {
      const value = kind === "json" ? JSON.parse(content) : YAML.parse(content);
      return { provider: `mirai.${kind}-graph-structure`, version: "1.0.0", candidates: structuredCandidates(value) };
    } catch {
      return { provider: `mirai.${kind}-graph-structure`, version: "1.0.0", candidates: [] };
    }
  }
  if (kind === "csv") {
    const header = content.split(/\r?\n/, 1)[0]?.split(",").map(safeLabel).filter(Boolean) || [];
    return {
      provider: "mirai.csv-header", version: "1.0.0",
      candidates: header.length ? [{ local_ref: "dataset", kind: "object", semantic_type: "tabular_dataset", label: `CSV dataset: ${header.join(", ")}`.slice(0, 160), confidence: 0.8 }] : []
    };
  }
  return { provider: "mirai.noop-text", version: "1.0.0", candidates: [] };
}
