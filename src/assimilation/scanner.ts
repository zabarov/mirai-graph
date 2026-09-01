import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { digestValue, sha256, withoutDigest } from "../core/canonical.js";
import {
  ASSIMILATION_PROPOSAL_CONTRACT_VERSION,
  SOURCE_CATALOG_CONTRACT_VERSION,
  type AssimilationProposal,
  type CandidateAssertion,
  type SourceCatalog,
  type SourceCatalogItem,
  type SourceDiagnostic,
  type SourceKind
} from "./types.js";
import { parseSourceCandidates } from "./parsers.js";

const EXTENSIONS: Record<string, { kind: SourceKind; media: string }> = {
  ".txt": { kind: "text", media: "text/plain" },
  ".md": { kind: "markdown", media: "text/markdown" },
  ".json": { kind: "json", media: "application/json" },
  ".yaml": { kind: "yaml", media: "application/yaml" },
  ".yml": { kind: "yaml", media: "application/yaml" },
  ".csv": { kind: "csv", media: "text/csv" }
};
const EXCLUDED_DIRS = new Set([".git", "node_modules", "dist", "vendor", ".idea", ".vscode"]);
const SECRET_NAMES = /(^|\/)(?:\.env(?:\..*)?|id_(?:rsa|ed25519)|.*\.(?:pem|key|p12|pfx)|credentials(?:\..*)?|secrets?(?:\..*)?)$/i;

function posixRelative(root: string, filename: string): string {
  return path.relative(root, filename).split(path.sep).join("/");
}

function collectFiles(root: string, current: string, diagnostics: SourceDiagnostic[]): string[] {
  const result: string[] = [];
  for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(current, entry.name);
    const relative = posixRelative(root, absolute);
    if (entry.isSymbolicLink()) {
      diagnostics.push({ code: "symlink_skipped", path: relative, severity: "warning", message: "Symbolic links are not followed." });
      continue;
    }
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) result.push(...collectFiles(root, absolute, diagnostics));
      continue;
    }
    if (entry.isFile()) result.push(absolute);
  }
  return result;
}

function gitValue(root: string, args: string[]): string | undefined {
  const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8", timeout: 5000 });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function sanitizeRepositoryRef(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    parsed.username = ""; parsed.password = ""; parsed.search = ""; parsed.hash = "";
    return parsed.toString();
  } catch {
    return value.replace(/^[^/@\s]+@([^:\s]+):/, "$1:").replace(/[?#].*$/, "");
  }
}

export function scanSource(rootInput: string, options: { maxFileBytes?: number } = {}): SourceCatalog {
  const root = fs.realpathSync(path.resolve(rootInput));
  if (!fs.statSync(root).isDirectory()) throw new Error("source_root_must_be_directory");
  const maxFileBytes = options.maxFileBytes ?? 1024 * 1024;
  const diagnostics: SourceDiagnostic[] = [];
  const revision = gitValue(root, ["rev-parse", "HEAD"]);
  const repositoryRef = sanitizeRepositoryRef(gitValue(root, ["config", "--get", "remote.origin.url"]));
  const items: SourceCatalogItem[] = [];

  for (const filename of collectFiles(root, root, diagnostics)) {
    const relative = posixRelative(root, filename);
    if (SECRET_NAMES.test(relative)) {
      diagnostics.push({ code: "secret_path_excluded", path: relative, severity: "warning", message: "A secret-like path was excluded from the catalog." });
      continue;
    }
    const format = EXTENSIONS[path.extname(filename).toLowerCase()];
    if (!format) {
      diagnostics.push({ code: "unsupported_format", path: relative, severity: "info", message: "Unsupported format was inventoried as a diagnostic and not parsed." });
      continue;
    }
    const stat = fs.statSync(filename);
    if (stat.size > maxFileBytes) {
      diagnostics.push({ code: "file_size_limit", path: relative, severity: "warning", message: `File exceeds ${maxFileBytes} bytes and was not read.` });
      continue;
    }
    const content = fs.readFileSync(filename);
    const fingerprint = sha256(content);
    const parsed = parseSourceCandidates(content.toString("utf8"), format.kind);
    items.push({
      id: `source.${sha256(relative).slice(7, 23)}`,
      path: relative,
      kind: format.kind,
      media_type: format.media,
      bytes: stat.size,
      fingerprint,
      provenance: {
        provider: "filesystem",
        ...(repositoryRef ? { repository_ref: repositoryRef } : {}),
        ...(revision ? { revision } : {})
      },
      parser: { provider: parsed.provider, version: parsed.version },
      extracted_candidates: parsed.candidates
    });
  }

  if (revision) {
    const message = gitValue(root, ["log", "-1", "--format=%s", revision]) || "";
    items.push({
      id: `git.commit.${revision.slice(0, 12)}`,
      path: `.git/commits/${revision}`,
      kind: "git_commit",
      media_type: "application/vnd.mirai.git-commit",
      bytes: Buffer.byteLength(message),
      fingerprint: sha256(`${revision}\n${message}`),
      provenance: { provider: "git", ...(repositoryRef ? { repository_ref: repositoryRef } : {}), revision },
      parser: { provider: "mirai.git-commit", version: "1.0.0" },
      extracted_candidates: [{ local_ref: revision, kind: "object", semantic_type: "source_revision", label: `Git commit ${revision.slice(0, 12)}`, confidence: 1 }]
    });
  }

  const candidate = {
    contract_version: SOURCE_CATALOG_CONTRACT_VERSION,
    root: ".",
    items: items.sort((a, b) => a.path.localeCompare(b.path)),
    diagnostics: diagnostics.sort((a, b) => `${a.path || ""}:${a.code}`.localeCompare(`${b.path || ""}:${b.code}`)),
    policies: {
      max_file_bytes: maxFileBytes,
      follow_symlinks: false as const,
      include_secrets: false as const,
      supported_extensions: Object.keys(EXTENSIONS).sort()
    },
    canonical_write_allowed: false as const
  };
  return { ...candidate, digest: digestValue(candidate) };
}

function identityKey(item: SourceCatalogItem): string {
  return path.basename(item.path, path.extname(item.path)).toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

export function assimilateCatalog(catalog: SourceCatalog): AssimilationProposal {
  if (catalog.canonical_write_allowed !== false) throw new Error("catalog_canonical_write_must_be_false");
  if (digestValue(withoutDigest(catalog as unknown as Record<string, unknown>)) !== catalog.digest) throw new Error("source_catalog_digest_mismatch");
  const duplicates = new Map<string, string[]>();
  const identities = new Map<string, SourceCatalogItem[]>();
  const assertions: CandidateAssertion[] = [];
  for (const item of catalog.items) {
    const duplicateRefs = duplicates.get(item.fingerprint) || [];
    duplicateRefs.push(item.id);
    duplicates.set(item.fingerprint, duplicateRefs);
    const key = identityKey(item);
    const versions = identities.get(key) || [];
    versions.push(item);
    identities.set(key, versions);
    const extracted = item.extracted_candidates.length ? item.extracted_candidates : [{ local_ref: "document", kind: "object" as const, semantic_type: item.kind === "git_commit" ? "source_revision" : "source_document", label: item.path, confidence: 1 }];
    extracted.forEach((candidate, index) => assertions.push({
      id: `candidate.${item.id}.${index + 1}`,
      kind: candidate.kind,
      semantic_type: candidate.semantic_type,
      label: candidate.label,
      source_ref: `${item.id}#${candidate.local_ref}`,
      confidence: candidate.confidence,
      provenance: { source_id: item.id, source_fingerprint: item.fingerprint }
    }));
  }
  const exactDuplicates = [...duplicates.entries()]
    .filter(([, refs]) => refs.length > 1)
    .map(([fingerprint, source_refs]) => ({ fingerprint, source_refs: source_refs.sort() }));
  const conflicts = [...identities.entries()]
    .filter(([, versions]) => new Set(versions.map((item) => item.fingerprint)).size > 1)
    .map(([identity_key, versions]) => ({
      identity_key,
      source_refs: versions.map((item) => item.id).sort(),
      resolution: "owner_review_required" as const
    }));
  const diagnostics = [...catalog.diagnostics];
  for (const conflict of conflicts) diagnostics.push({
    code: "conflicting_source_versions",
    severity: "blocking",
    message: `Conflicting source versions for ${conflict.identity_key} require owner review.`
  });
  const blocking = diagnostics.filter((item) => item.severity === "blocking").length;
  const candidate = {
    contract_version: ASSIMILATION_PROPOSAL_CONTRACT_VERSION,
    source_catalog_digest: catalog.digest,
    candidate_assertions: assertions.sort((a, b) => a.id.localeCompare(b.id)),
    exact_duplicates: exactDuplicates.sort((a, b) => a.fingerprint.localeCompare(b.fingerprint)),
    conflicts: conflicts.sort((a, b) => a.identity_key.localeCompare(b.identity_key)),
    quality: {
      provenance_coverage: assertions.length ? assertions.filter((item) => item.provenance.source_fingerprint).length / assertions.length : 1,
      blocking_diagnostic_count: blocking,
      readiness: blocking ? "blocked" as const : "ready_for_review" as const
    },
    diagnostics: diagnostics.sort((a, b) => `${a.path || ""}:${a.code}:${a.message}`.localeCompare(`${b.path || ""}:${b.code}:${b.message}`)),
    canonical_write_allowed: false as const,
    next_safe_action: blocking ? "resolve_blocking_diagnostics" as const : "owner_review" as const
  };
  return { ...candidate, digest: digestValue(candidate) };
}
