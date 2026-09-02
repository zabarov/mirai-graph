import fs from "node:fs";
import path from "node:path";
import net, { type LookupFunction } from "node:net";
import http from "node:http";
import https from "node:https";
import { promises as dns } from "node:dns";
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";
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

const SECRET_PATH = /(^|\/)(?:\.env(?:\..*)?|\.npmrc|\.pypirc|\.netrc|id_(?:rsa|ed25519)|.*\.(?:pem|key|p12|pfx)|credentials(?:\..*)?|secrets?(?:\..*)?|service-account[^/]*\.json)$/i;
const EXCLUDED_DIRS = new Set([".git", "node_modules", "dist", "vendor", ".idea", ".vscode", ".mirai"]);
const MEDIA_TYPES: Record<string, string> = {
  ".txt": "text/plain", ".md": "text/markdown", ".json": "application/json", ".yaml": "application/yaml", ".yml": "application/yaml",
  ".csv": "text/csv", ".html": "text/html", ".htm": "text/html", ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

const BLOCKED_IPS = new net.BlockList();
const GLOBAL_IPV6 = new net.BlockList();
GLOBAL_IPV6.addSubnet("2000::", 3, "ipv6");
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4]
] as Array<[string, number]>) BLOCKED_IPS.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
  ["::", 128], ["::1", 128], ["64:ff9b:1::", 48], ["100::", 64],
  ["2001::", 32], ["2001:2::", 48], ["2001:10::", 28], ["2001:20::", 28],
  ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]
] as Array<[string, number]>) BLOCKED_IPS.addSubnet(network, prefix, "ipv6");

function normalizedSecretKey(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[-.]/g, "_").toLowerCase();
}

function isSecretConfigurationKey(key: string): boolean {
  const normalized = normalizedSecretKey(key);
  return /(?:^|_)(?:password|passwd|secret|token)$/.test(normalized)
    || /(?:^|_)(?:api|access|refresh|private|client|auth)_(?:key|token|secret)$/.test(normalized)
    || /^(?:authorization|cookie|bearer|session_id|session_token)$/.test(normalized);
}

function assertBudget(budget: SourceBudget): void {
  for (const [name, value] of Object.entries(budget)) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`source_budget_invalid:${name}`);
  }
}

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
  if (/(?:^|[?&;\s])[^=&\s]*(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)[^=&\s]*=/i.test(descriptor.locator)) errors.push("source_locator_contains_secret_material");
  if (/^[a-z][a-z0-9+.-]*:\/\/[^/\s]+:[^@\s]+@/i.test(descriptor.locator)) errors.push("source_locator_contains_credentials");
  if (descriptor.connection_ref && /[:=@]/.test(descriptor.connection_ref)) errors.push("connection_ref_must_be_secret_alias_only");
  const secretValue = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bghp_[A-Za-z0-9]{20,}\b|\bxoxb-[A-Za-z0-9-]{20,}\b|\bAKIA[0-9A-Z]{16}\b/;
  const inspect = (value: unknown): boolean => {
    if (typeof value === "string") return secretValue.test(value);
    if (Array.isArray(value)) return value.some(inspect);
    if (!value || typeof value !== "object") return false;
    return Object.entries(value as Record<string, unknown>).some(([key, child]) => isSecretConfigurationKey(key) || inspect(child));
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

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function openedFileStat(root: string, filename: string, fileDescriptor: number, key: string): fs.Stats {
  const opened = fs.fstatSync(fileDescriptor);
  let currentResolved: string;
  let current: fs.Stats;
  try {
    currentResolved = fs.realpathSync(filename);
    current = fs.statSync(currentResolved);
  } catch {
    throw new Error(`source_file_changed_during_read:${key}`);
  }
  if (!isWithin(root, currentResolved)) throw new Error(`source_file_scope_escape:${key}`);
  if (opened.dev !== current.dev || opened.ino !== current.ino) throw new Error(`source_file_changed_during_read:${key}`);
  return opened;
}

function filePayloads(rootInput: string, budget: SourceBudget): SourcePayload[] {
  assertBudget(budget);
  const root = fs.realpathSync(path.resolve(rootInput));
  if (!fs.statSync(root).isDirectory()) throw new Error("source_root_must_be_directory");
  const files: string[] = [];
  collectFiles(root, root, files, budget);
  const payloads: SourcePayload[] = [];
  let totalBytes = 0;
  for (const filename of files) {
    const key = path.relative(root, filename).split(path.sep).join("/");
    const resolved = fs.realpathSync(filename);
    if (!isWithin(root, resolved)) throw new Error(`source_file_scope_escape:${key}`);
    const noFollow = typeof fs.constants.O_NOFOLLOW === "number" ? fs.constants.O_NOFOLLOW : 0;
    const fileDescriptor = fs.openSync(resolved, fs.constants.O_RDONLY | noFollow);
    let content: Buffer;
    try {
      const stat = openedFileStat(root, resolved, fileDescriptor, key);
      if (!stat.isFile()) throw new Error(`source_file_not_regular:${key}`);
      if (stat.size > budget.max_item_bytes) throw new Error(`source_item_bytes_exceeded:${key}`);
      totalBytes += stat.size;
      if (totalBytes > budget.max_total_bytes) throw new Error("source_total_bytes_exceeded");
      content = fs.readFileSync(fileDescriptor);
    } finally {
      fs.closeSync(fileDescriptor);
    }
    payloads.push({
      key,
      media_type: MEDIA_TYPES[path.extname(filename).toLowerCase()] as string,
      content,
      version: sha256(content)
    });
  }
  return withinBudget(payloads, budget);
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
  if (normalized.startsWith("::ffff:")) return true;
  const family = net.isIP(normalized);
  if (!family) return true;
  if (family === 6 && !GLOBAL_IPV6.check(normalized, "ipv6")) return true;
  return BLOCKED_IPS.check(normalized, family === 4 ? "ipv4" : "ipv6");
}

async function discardResponseBody(response: Response): Promise<void> {
  try { await response.body?.cancel(); } catch { /* The response is being rejected anyway. */ }
}

export interface HttpFetchContext {
  hostname: string;
  approved_addresses: string[];
}

type FetchLike = (input: string | URL, init: RequestInit, context: HttpFetchContext) => Promise<Response>;
type ResolveLike = (hostname: string) => Promise<string[]>;

function pinnedFetch(input: string | URL, init: RequestInit, context: HttpFetchContext): Promise<Response> {
  const url = new URL(input);
  const approved = context.approved_addresses.map((address) => ({ address, family: net.isIP(address) }));
  if (!approved.length || context.hostname !== url.hostname || approved.some((entry) => !entry.family)) return Promise.reject(new Error("http_pinned_addresses_required"));
  const lookup = ((_hostname: string, options: unknown, callback: (...args: unknown[]) => void) => {
    if (options && typeof options === "object" && "all" in options && (options as { all?: boolean }).all) callback(null, approved);
    else callback(null, approved[0]?.address, approved[0]?.family);
  }) as LookupFunction;
  const headers = Object.fromEntries(new Headers(init.headers || {}).entries());
  const transport = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = transport.request(url, { method: init.method || "GET", headers, lookup, agent: false, signal: init.signal as AbortSignal }, (response) => {
      const responseHeaders = new Headers();
      for (const [name, value] of Object.entries(response.headers)) {
        if (Array.isArray(value)) value.forEach((item) => responseHeaders.append(name, item));
        else if (value !== undefined) responseHeaders.set(name, String(value));
      }
      const status = response.statusCode || 500;
      const body = status === 204 || status === 205 || status === 304 ? null : Readable.toWeb(response);
      resolve(new Response(body as BodyInit | null, { status, statusText: response.statusMessage, headers: responseHeaders }));
    });
    request.once("error", reject);
    request.end();
  });
}

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

async function withAbortTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs: number, code: string): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort(new Error(code));
          reject(new Error(code));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readResponseBounded(response: Response, maxBytes: number, deadline: number): Promise<Uint8Array> {
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
      const remainingMs = deadline - Date.now();
      if (remainingMs < 1) {
        await reader.cancel("http_source_timeout");
        throw new Error("http_source_timeout");
      }
      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await withTimeout(reader.read(), remainingMs, "http_source_timeout");
      } catch (error) {
        try { await reader.cancel("http_source_timeout"); } catch { /* The timeout remains authoritative. */ }
        throw error;
      }
      const { done, value } = result;
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
  const fetcher = options.fetcher || pinnedFetch;
  const resolver = options.resolver || defaultResolve;
  return {
    id: "mirai.source.http",
    kind: "http",
    read_only: true,
    operations: ["read", "snapshot"],
    async scan(descriptor, budget) {
      assertDescriptor(descriptor, "http");
      assertBudget(budget);
      const config = descriptor.configuration;
      const allowed = Array.isArray(config.allowed_hosts) ? config.allowed_hosts.map(String) : [];
      if (!allowed.length) throw new Error("http_allowed_hosts_required");
      const paths = Array.isArray(config.paths) && config.paths.length ? config.paths.map(String) : [""];
      if (paths.length > budget.max_items) throw new Error("source_item_budget_exceeded");
      const maxRedirects = Math.min(Number(config.max_redirects ?? 3), 5);
      const payloads: SourcePayload[] = [];
      const deadline = Date.now() + budget.timeout_ms;
      let totalBytes = 0;
      for (const suffix of paths) {
        let url = new URL(suffix, descriptor.locator);
        let response: Response | undefined;
        for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
          if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error("http_locator_unsafe");
          if (!allowed.includes(url.hostname)) throw new Error(`http_host_not_allowed:${url.hostname}`);
          const remainingMs = deadline - Date.now();
          if (remainingMs < 1) throw new Error("http_source_timeout");
          const addresses = [...new Set(await withTimeout(resolver(url.hostname), remainingMs, "http_dns_timeout"))].sort();
          if (!addresses.length || addresses.some(isPrivateIp)) throw new Error(`http_private_address_forbidden:${url.hostname}`);
          const requestRemainingMs = deadline - Date.now();
          if (requestRemainingMs < 1) throw new Error("http_source_timeout");
          response = await withAbortTimeout((signal) => fetcher(url, { method: "GET", redirect: "manual", signal, headers: { accept: "text/html,text/plain,application/json,application/pdf,*/*;q=0.1" } }, { hostname: url.hostname, approved_addresses: addresses }), requestRemainingMs, "http_source_timeout");
          if (Date.now() > deadline) {
            await discardResponseBody(response);
            throw new Error("http_source_timeout");
          }
          if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location");
            if (!location || redirect === maxRedirects) {
              await discardResponseBody(response);
              throw new Error("http_redirect_budget_exceeded");
            }
            await discardResponseBody(response);
            url = new URL(location, url);
            continue;
          }
          break;
        }
        if (!response?.ok) {
          if (response) await discardResponseBody(response);
          throw new Error(`http_source_failed:${response?.status ?? "no_response"}`);
        }
        const remainingBytes = budget.max_total_bytes - totalBytes;
        if (remainingBytes < 1) throw new Error("source_total_bytes_exceeded");
        const itemLimit = Math.min(budget.max_item_bytes, remainingBytes);
        const declared = Number(response.headers.get("content-length") || 0);
        if (declared > itemLimit) {
          await discardResponseBody(response);
          throw new Error("http_content_length_exceeded");
        }
        const content = await readResponseBounded(response, itemLimit, deadline);
        totalBytes += content.byteLength;
        const mediaType = (response.headers.get("content-type") || "application/octet-stream").split(";")[0] as string;
        payloads.push({ key: url.toString(), media_type: mediaType, content, etag: response.headers.get("etag") || undefined, modified_at: response.headers.get("last-modified") || undefined });
      }
      return withinBudget(payloads, budget);
    }
  };
}

export interface SqlReadClient {
  readonly read_only: true;
  query(statement: string, params: unknown[], limits: { max_rows: number; timeout_ms: number; signal?: AbortSignal }): Promise<Array<Record<string, unknown>>>;
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
      assertBudget(budget);
      const queryId = String(descriptor.configuration.query_id || "");
      const statement = templates[queryId];
      if (!statement) throw new Error(`sql_query_template_unknown:${queryId}`);
      assertReadQuery(statement);
      const params = Array.isArray(descriptor.configuration.params) ? descriptor.configuration.params : [];
      const rowLimit = budget.max_items === Number.MAX_SAFE_INTEGER ? budget.max_items : budget.max_items + 1;
      const rows = await withAbortTimeout((signal) => client.query(statement, params, { max_rows: rowLimit, timeout_ms: budget.timeout_ms, signal }), budget.timeout_ms, "sql_query_timeout");
      if (rows.length > budget.max_items) throw new Error("sql_row_budget_exceeded");
      const payloads: SourcePayload[] = [];
      let totalBytes = 0;
      rows.forEach((row, index) => {
        const content = Buffer.from(JSON.stringify(row));
        if (content.byteLength > budget.max_item_bytes) throw new Error(`source_item_bytes_exceeded:${queryId}/row-${index + 1}`);
        totalBytes += content.byteLength;
        if (totalBytes > budget.max_total_bytes) throw new Error("source_total_bytes_exceeded");
        payloads.push({ key: `${queryId}/row-${index + 1}`, media_type: "application/json", content, version: sha256(content) });
      });
      return withinBudget(payloads, budget);
    }
  };
}

export interface S3ReadObject {
  content: Uint8Array;
  etag?: string;
  version?: string;
}

export interface S3ReadClient {
  readonly read_only: true;
  list(bucket: string, prefix: string, limit: number, limits?: { timeout_ms?: number; signal?: AbortSignal }): Promise<Array<{ key: string; etag?: string; version?: string; bytes?: number }>>;
  get(bucket: string, key: string, version?: string, limits?: { max_bytes: number; timeout_ms?: number; signal?: AbortSignal }): Promise<Uint8Array | S3ReadObject>;
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
      assertBudget(budget);
      const bucket = String(descriptor.configuration.bucket || "");
      const prefix = String(descriptor.configuration.prefix || "");
      const allowedBucket = String(descriptor.configuration.allowed_bucket || "");
      const allowedPrefix = String(descriptor.configuration.allowed_prefix || "");
      if (!bucket || bucket !== allowedBucket || !prefix.startsWith(allowedPrefix) || prefix.includes("..")) throw new Error("s3_scope_not_allowed");
      const deadline = Date.now() + budget.timeout_ms;
      const objectLimit = budget.max_items === Number.MAX_SAFE_INTEGER ? budget.max_items : budget.max_items + 1;
      const listRemainingMs = Math.max(1, deadline - Date.now());
      const objects = await withAbortTimeout((signal) => client.list(bucket, prefix, objectLimit, { timeout_ms: listRemainingMs, signal }), listRemainingMs, "s3_list_timeout");
      if (objects.length > budget.max_items) throw new Error("source_item_budget_exceeded");
      const payloads: SourcePayload[] = [];
      let totalBytes = 0;
      for (const object of objects) {
        if (!object.key.startsWith(allowedPrefix) || object.key.includes("..")) throw new Error("s3_object_scope_escape");
        if (object.bytes && object.bytes > budget.max_item_bytes) throw new Error(`source_item_bytes_exceeded:${object.key}`);
        const remainingBytes = budget.max_total_bytes - totalBytes;
        if (remainingBytes < 1) throw new Error("source_total_bytes_exceeded");
        const maxBytes = Math.min(budget.max_item_bytes, remainingBytes);
        const remainingMs = deadline - Date.now();
        if (remainingMs < 1) throw new Error("s3_source_timeout");
        const fetched = await withAbortTimeout((signal) => client.get(bucket, object.key, object.version, { max_bytes: maxBytes, timeout_ms: remainingMs, signal }), remainingMs, "s3_get_timeout");
        const result: S3ReadObject = fetched instanceof Uint8Array ? { content: fetched } : fetched;
        if (result.content.byteLength > maxBytes) throw new Error(`source_item_bytes_exceeded:${object.key}`);
        totalBytes += result.content.byteLength;
        payloads.push({ key: object.key, media_type: MEDIA_TYPES[path.extname(object.key).toLowerCase()] || "application/octet-stream", content: result.content, etag: result.etag || object.etag, version: result.version || object.version });
      }
      return withinBudget(payloads, budget);
    }
  };
}

export function buildSourceSnapshot(descriptor: SourceDescriptor, payloads: SourcePayload[], previous?: SourceSnapshot, budget: SourceBudget = DEFAULT_SOURCE_BUDGET): SourceSnapshot {
  const descriptorErrors = validateSourceDescriptor(descriptor);
  if (descriptorErrors.length) throw new Error(descriptorErrors.join(","));
  assertBudget(budget);
  withinBudget(payloads, budget);
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
