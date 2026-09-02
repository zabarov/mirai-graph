import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { promises as dns } from "node:dns";
import { spawnSync } from "node:child_process";
import { digestValue, sha256 } from "../core/canonical.js";
import {
  DEFAULT_SOURCE_BUDGET,
  SOURCE_SNAPSHOT_CONTRACT_VERSION,
  type SourceBudget,
  type SourceDescriptor,
  type SourcePayload,
  type SourceProvider,
  type SourceProviderKind,
  type SourceSnapshot
} from "./types.js";

const SECRET_PATH = /(^|\/)(?:\.env(?:\..*)?|id_(?:rsa|ed25519)|.*\.(?:pem|key|p12|pfx)|credentials(?:\..*)?|secrets?(?:\..*)?)$/i;
const EXCLUDED_DIRS = new Set([".git", "node_modules", "dist", "vendor", ".idea", ".vscode", ".mirai"]);
const MEDIA_TYPES: Record<string, string> = {
  ".txt": "text/plain", ".md": "text/markdown", ".json": "application/json", ".yaml": "application/yaml", ".yml": "application/yaml",
  ".csv": "text/csv", ".html": "text/html", ".htm": "text/html", ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

function withinBudget(payloads: SourcePayload[], budget: SourceBudget): SourcePayload[] {
  if (payloads.length > budget.max_items) throw new Error("source_item_budget_exceeded");
  let total = 0;
  for (const payload of payloads) {
    if (payload.content.byteLength > budget.max_item_bytes) throw new Error(`source_item_bytes_exceeded:${payload.key}`);
    total += payload.content.byteLength;
    if (total > budget.max_total_bytes) throw new Error("source_total_bytes_exceeded");
  }
  return payloads.sort((a, b) => a.key.localeCompare(b.key));
}

export function validateSourceDescriptor(descriptor: SourceDescriptor, expectedKind?: SourceProviderKind): string[] {
  const errors: string[] = [];
  if (descriptor.contract_version !== "1.0.0") errors.push("source_descriptor_contract_unsupported");
  if (!descriptor.id || !descriptor.locator || !descriptor.scope) errors.push("source_descriptor_required_field_missing");
  if (descriptor.read_only !== true) errors.push("source_provider_must_be_read_only");
  if (expectedKind && descriptor.provider !== expectedKind) errors.push(`source_provider_kind_mismatch:${expectedKind}`);
  if (/(?:password|token|secret|apikey|api_key)=/i.test(descriptor.locator)) errors.push("source_locator_contains_secret_material");
  if (/^[a-z][a-z0-9+.-]*:\/\/[^/\s]+:[^@\s]+@/i.test(descriptor.locator)) errors.push("source_locator_contains_credentials");
  if (descriptor.connection_ref && /[:=@]/.test(descriptor.connection_ref)) errors.push("connection_ref_must_be_secret_alias_only");
  const secretKey = /^(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)$/i;
  const secretValue = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bghp_[A-Za-z0-9]{20,}\b|\bxoxb-[A-Za-z0-9-]{20,}\b|\bAKIA[0-9A-Z]{16}\b/;
  const inspect = (value: unknown): boolean => {
    if (typeof value === "string") return secretValue.test(value);
    if (Array.isArray(value)) return value.some(inspect);
    if (!value || typeof value !== "object") return false;
    return Object.entries(value as Record<string, unknown>).some(([key, child]) => secretKey.test(key) || inspect(child));
  };
  if (inspect(descriptor.configuration)) errors.push("source_configuration_contains_secret_material");
  return errors;
}

function assertDescriptor(descriptor: SourceDescriptor, kind: SourceProviderKind): void {
  const errors = validateSourceDescriptor(descriptor, kind);
  if (errors.length) throw new Error(errors.join(","));
}

function collectFiles(root: string, current: string, output: string[], budget: SourceBudget): void {
  for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(current, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    if (entry.isSymbolicLink() || SECRET_PATH.test(relative)) continue;
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) collectFiles(root, absolute, output, budget);
    } else if (entry.isFile() && MEDIA_TYPES[path.extname(entry.name).toLowerCase()]) output.push(absolute);
    if (output.length > budget.max_items) throw new Error("source_item_budget_exceeded");
  }
}

function filePayloads(rootInput: string, budget: SourceBudget): SourcePayload[] {
  const root = fs.realpathSync(path.resolve(rootInput));
  if (!fs.statSync(root).isDirectory()) throw new Error("source_root_must_be_directory");
  const files: string[] = [];
  collectFiles(root, root, files, budget);
  return withinBudget(files.map((filename) => {
    const key = path.relative(root, filename).split(path.sep).join("/");
    const content = fs.readFileSync(filename);
    return {
      key,
      media_type: MEDIA_TYPES[path.extname(filename).toLowerCase()] as string,
      content,
      version: sha256(content)
    };
  }), budget);
}

export function createFilesystemSourceProvider(): SourceProvider {
  return {
    id: "mirai.source.filesystem",
    kind: "filesystem",
    read_only: true,
    operations: ["discover", "read", "observe", "snapshot"],
    async scan(descriptor, budget) {
      assertDescriptor(descriptor, "filesystem");
      return filePayloads(descriptor.locator, budget);
    }
  };
}

export function createGitSourceProvider(): SourceProvider {
  return {
    id: "mirai.source.git",
    kind: "git",
    read_only: true,
    operations: ["discover", "read", "observe", "snapshot"],
    async scan(descriptor, budget) {
      assertDescriptor(descriptor, "git");
      const payloads = filePayloads(descriptor.locator, budget);
      const revision = spawnSync("git", ["-C", path.resolve(descriptor.locator), "rev-parse", "HEAD"], { encoding: "utf8", timeout: Math.min(5000, budget.timeout_ms) });
      if (revision.status !== 0) throw new Error("git_revision_unavailable");
      const commit = revision.stdout.trim();
      payloads.push({ key: `.git/commits/${commit}`, media_type: "application/vnd.mirai.git-commit", content: Buffer.from(commit), version: commit });
      return withinBudget(payloads, budget);
    }
  };
}

function isPrivateIp(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIp(mapped[1] as string);
  if (net.isIPv4(normalized)) {
    const [a = 0, b = 0] = normalized.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const value = normalized;
  return value === "::1" || value === "::" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb");
}

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
type ResolveLike = (hostname: string) => Promise<string[]>;

async function defaultResolve(hostname: string): Promise<string[]> {
  if (net.isIP(hostname)) return [hostname];
  return (await dns.lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address);
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, code: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => { timer = setTimeout(() => reject(new Error(code)), timeoutMs); })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readResponseBounded(response: Response, maxBytes: number): Promise<Uint8Array> {
  if (!response.body) {
    const content = new Uint8Array(await response.arrayBuffer());
    if (content.byteLength > maxBytes) throw new Error("http_body_budget_exceeded");
    return content;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("http_body_budget_exceeded");
        throw new Error("http_body_budget_exceeded");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}

export function createHttpSourceProvider(options: { fetcher?: FetchLike; resolver?: ResolveLike } = {}): SourceProvider {
  const fetcher = options.fetcher || fetch;
  const resolver = options.resolver || defaultResolve;
  return {
    id: "mirai.source.http",
    kind: "http",
    read_only: true,
    operations: ["read", "snapshot"],
    async scan(descriptor, budget) {
      assertDescriptor(descriptor, "http");
      const config = descriptor.configuration;
      const allowed = Array.isArray(config.allowed_hosts) ? config.allowed_hosts.map(String) : [];
      if (!allowed.length) throw new Error("http_allowed_hosts_required");
      const paths = Array.isArray(config.paths) && config.paths.length ? config.paths.map(String) : [""];
      const maxRedirects = Math.min(Number(config.max_redirects ?? 3), 5);
      const payloads: SourcePayload[] = [];
      for (const suffix of paths) {
        let url = new URL(suffix, descriptor.locator);
        let response: Response | undefined;
        for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
          if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error("http_locator_unsafe");
          if (!allowed.includes(url.hostname)) throw new Error(`http_host_not_allowed:${url.hostname}`);
          const addresses = await resolver(url.hostname);
          if (!addresses.length || addresses.some(isPrivateIp)) throw new Error(`http_private_address_forbidden:${url.hostname}`);
          response = await fetcher(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(budget.timeout_ms), headers: { accept: "text/html,text/plain,application/json,application/pdf,*/*;q=0.1" } });
          if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location");
            if (!location || redirect === maxRedirects) throw new Error("http_redirect_budget_exceeded");
            url = new URL(location, url);
            continue;
          }
          break;
        }
        if (!response?.ok) throw new Error(`http_source_failed:${response?.status ?? "no_response"}`);
        const declared = Number(response.headers.get("content-length") || 0);
        if (declared > budget.max_item_bytes) throw new Error("http_content_length_exceeded");
        const content = await readResponseBounded(response, budget.max_item_bytes);
        const mediaType = (response.headers.get("content-type") || "application/octet-stream").split(";")[0] as string;
        payloads.push({ key: url.toString(), media_type: mediaType, content, etag: response.headers.get("etag") || undefined, modified_at: response.headers.get("last-modified") || undefined });
      }
      return withinBudget(payloads, budget);
    }
  };
}

export interface SqlReadClient {
  readonly read_only: true;
  query(statement: string, params: unknown[], limits: { max_rows: number; timeout_ms: number }): Promise<Array<Record<string, unknown>>>;
}

function assertReadQuery(statement: string): void {
  const normalized = statement.replace(/\s+/g, " ").trim();
  if (!/^(?:select|with)\b/i.test(normalized)) throw new Error("sql_read_query_required");
  if (/;\s*\S|\b(?:insert|update|delete|alter|drop|create|truncate|grant|revoke|copy|call|execute)\b/i.test(normalized)) throw new Error("sql_mutation_forbidden");
  if (/--|\/\*/.test(normalized)) throw new Error("sql_comments_forbidden");
}

export function createSqlSourceProvider(kind: "postgres" | "mysql", client: SqlReadClient, templates: Record<string, string>): SourceProvider {
  if (client.read_only !== true) throw new Error("sql_client_must_be_read_only");
  return {
    id: `mirai.source.${kind}`,
    kind,
    read_only: true,
    operations: ["query", "snapshot"],
    async scan(descriptor, budget) {
      assertDescriptor(descriptor, kind);
      const queryId = String(descriptor.configuration.query_id || "");
      const statement = templates[queryId];
      if (!statement) throw new Error(`sql_query_template_unknown:${queryId}`);
      assertReadQuery(statement);
      const params = Array.isArray(descriptor.configuration.params) ? descriptor.configuration.params : [];
      const rows = await client.query(statement, params, { max_rows: budget.max_items, timeout_ms: budget.timeout_ms });
      if (rows.length > budget.max_items) throw new Error("sql_row_budget_exceeded");
      return withinBudget(rows.map((row, index) => {
        const content = Buffer.from(JSON.stringify(row));
        return { key: `${queryId}/row-${index + 1}`, media_type: "application/json", content, version: sha256(content) };
      }), budget);
    }
  };
}

export interface S3ReadClient {
  readonly read_only: true;
  list(bucket: string, prefix: string, limit: number): Promise<Array<{ key: string; etag?: string; version?: string; bytes?: number }>>;
  get(bucket: string, key: string, version?: string): Promise<Uint8Array>;
}

export function createS3SourceProvider(client: S3ReadClient): SourceProvider {
  if (client.read_only !== true) throw new Error("s3_client_must_be_read_only");
  return {
    id: "mirai.source.s3",
    kind: "s3",
    read_only: true,
    operations: ["discover", "read", "snapshot"],
    async scan(descriptor, budget) {
      assertDescriptor(descriptor, "s3");
      const bucket = String(descriptor.configuration.bucket || "");
      const prefix = String(descriptor.configuration.prefix || "");
      const allowedBucket = String(descriptor.configuration.allowed_bucket || "");
      const allowedPrefix = String(descriptor.configuration.allowed_prefix || "");
      if (!bucket || bucket !== allowedBucket || !prefix.startsWith(allowedPrefix) || prefix.includes("..")) throw new Error("s3_scope_not_allowed");
      const objects = await withTimeout(client.list(bucket, prefix, budget.max_items), budget.timeout_ms, "s3_list_timeout");
      if (objects.length > budget.max_items) throw new Error("source_item_budget_exceeded");
      const payloads: SourcePayload[] = [];
      for (const object of objects) {
        if (!object.key.startsWith(allowedPrefix) || object.key.includes("..")) throw new Error("s3_object_scope_escape");
        if (object.bytes && object.bytes > budget.max_item_bytes) throw new Error(`source_item_bytes_exceeded:${object.key}`);
        payloads.push({ key: object.key, media_type: MEDIA_TYPES[path.extname(object.key).toLowerCase()] || "application/octet-stream", content: await withTimeout(client.get(bucket, object.key, object.version), budget.timeout_ms, "s3_get_timeout"), etag: object.etag, version: object.version });
      }
      return withinBudget(payloads, budget);
    }
  };
}

export function buildSourceSnapshot(descriptor: SourceDescriptor, payloads: SourcePayload[], previous?: SourceSnapshot, budget: SourceBudget = DEFAULT_SOURCE_BUDGET): SourceSnapshot {
  const locatorDigest = digestValue(descriptor.locator);
  const items = payloads.map((payload) => ({
    source_id: descriptor.id,
    key: payload.key,
    media_type: payload.media_type,
    bytes: payload.content.byteLength,
    fingerprint: sha256(Buffer.from(payload.content)),
    ...(payload.modified_at ? { modified_at: payload.modified_at } : {}),
    ...(payload.etag ? { etag: payload.etag } : {}),
    ...(payload.version ? { version: payload.version } : {}),
    authority: descriptor.authority,
    scope: descriptor.scope,
    confidentiality: descriptor.confidentiality,
    provenance: { provider: descriptor.provider, locator_digest: locatorDigest, ...(descriptor.connection_ref ? { connection_ref: descriptor.connection_ref } : {}) }
  })).sort((a, b) => a.key.localeCompare(b.key));
  const before = new Map((previous?.items || []).map((item) => [item.key, item]));
  const after = new Map(items.map((item) => [item.key, item]));
  const keys = [...new Set([...before.keys(), ...after.keys()])].sort();
  const changes = keys.map((key) => {
    const oldItem = before.get(key);
    const newItem = after.get(key);
    if (!newItem) return { key, state: "source_missing" as const, previous_fingerprint: oldItem?.fingerprint };
    if (!oldItem) return { key, state: "added" as const, current_fingerprint: newItem.fingerprint };
    return oldItem.fingerprint === newItem.fingerprint
      ? { key, state: "unchanged" as const, previous_fingerprint: oldItem.fingerprint, current_fingerprint: newItem.fingerprint }
      : { key, state: "changed" as const, previous_fingerprint: oldItem.fingerprint, current_fingerprint: newItem.fingerprint };
  });
  const candidate = {
    contract_version: SOURCE_SNAPSHOT_CONTRACT_VERSION,
    source: { ...descriptor, configuration_digest: digestValue(descriptor.configuration), configuration: undefined },
    items,
    changes,
    budgets: budget,
    canonical_write_allowed: false as const
  };
  const { configuration: _configuration, ...source } = candidate.source as typeof candidate.source & { configuration?: undefined };
  const clean = { ...candidate, source };
  return { ...clean, digest: digestValue(clean) } as SourceSnapshot;
}

export async function createSourceSnapshot(provider: SourceProvider, descriptor: SourceDescriptor, previous?: SourceSnapshot, budget: SourceBudget = DEFAULT_SOURCE_BUDGET): Promise<SourceSnapshot> {
  if (provider.kind !== descriptor.provider || provider.read_only !== true) throw new Error("source_provider_descriptor_mismatch");
  const payloads = await provider.scan(descriptor, budget);
  return buildSourceSnapshot(descriptor, payloads, previous, budget);
}

export function diffSourceSnapshots(previous: SourceSnapshot, current: SourceSnapshot): SourceSnapshot["changes"] {
  if (previous.source.id !== current.source.id) throw new Error("source_snapshot_identity_mismatch");
  return current.changes;
}
