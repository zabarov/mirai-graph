const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { zipSync, strToU8 } = require("fflate");

const {
  DEFAULT_SOURCE_BUDGET,
  buildSourceSnapshot,
  convertPayloads,
  createFilesystemSourceProvider,
  createHttpSourceProvider,
  createS3SourceProvider,
  createSqlSourceProvider,
  diffSourceSnapshots,
  validateSourceDescriptor
} = require("../../dist/cjs/sources");
const { createS3ReadClient } = require("../../packages/source-s3");

function descriptor(kind, locator, configuration = {}) {
  return { contract_version: "1.0.0", id: `source.${kind}`, provider: kind, locator, authority: "owner_asserted", scope: "test", confidentiality: "internal", freshness: {}, read_only: true, configuration };
}

test("filesystem snapshots are deterministic, incremental and exclude secret paths", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-sources-"));
  try {
    fs.writeFileSync(path.join(root, "policy.md"), "# Policy\nowner: team\n");
    fs.writeFileSync(path.join(root, ".env"), "TOKEN=must-not-leak\n");
    const source = descriptor("filesystem", root);
    const provider = createFilesystemSourceProvider();
    assert.deepEqual(provider.operations, ["discover", "read", "observe", "snapshot"]);
    const firstPayloads = await provider.scan(source, DEFAULT_SOURCE_BUDGET);
    const first = buildSourceSnapshot(source, firstPayloads);
    const second = buildSourceSnapshot(source, await provider.scan(source, DEFAULT_SOURCE_BUDGET));
    assert.equal(first.digest, second.digest);
    assert.equal(JSON.stringify(first).includes("must-not-leak"), false);
    assert.equal(first.items.some((item) => item.key === ".env"), false);
    const conversion = await convertPayloads(first, firstPayloads, DEFAULT_SOURCE_BUDGET);
    assert.equal(conversion.units.length > 0, true);
    assert.equal(conversion.units.every((unit) => unit.instructions_authorized === false), true);
    fs.writeFileSync(path.join(root, "policy.md"), "# Policy\nowner: governance\n");
    const changed = buildSourceSnapshot(source, await provider.scan(source, DEFAULT_SOURCE_BUDGET), first);
    assert.equal(diffSourceSnapshots(first, changed).some((item) => item.state === "changed"), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("HTTP, SQL and S3 providers fail closed at their read boundaries", async () => {
  const http = createHttpSourceProvider({ resolver: async () => ["127.0.0.1"], fetcher: async () => { throw new Error("fetch_must_not_run"); } });
  await assert.rejects(() => http.scan(descriptor("http", "https://example.test/", { allowed_hosts: ["example.test"] }), DEFAULT_SOURCE_BUDGET), /http_private_address_forbidden/);

  const sql = createSqlSourceProvider("postgres", { read_only: true, query: async () => [] }, { unsafe: "DELETE FROM records" });
  assert.deepEqual(sql.operations, ["query", "snapshot"]);
  await assert.rejects(() => sql.scan(descriptor("postgres", "database-alias", { query_id: "unsafe" }), DEFAULT_SOURCE_BUDGET), /sql_read_query_required|sql_mutation_forbidden/);

  const s3 = createS3SourceProvider({ read_only: true, list: async () => [{ key: "outside/private.txt" }], get: async () => Buffer.from("x") });
  await assert.rejects(() => s3.scan(descriptor("s3", "bucket-alias", { bucket: "docs", allowed_bucket: "docs", prefix: "public/", allowed_prefix: "public/" }), DEFAULT_SOURCE_BUDGET), /s3_object_scope_escape/);
});

test("source descriptors reject embedded credentials and HTTP bodies are bounded while streaming", async () => {
  const unsafe = descriptor("postgres", "postgres://reader:secret@example.test/data", { password: "not-allowed" });
  assert.deepEqual(validateSourceDescriptor(unsafe).sort(), ["source_configuration_contains_secret_material", "source_locator_contains_credentials"]);

  const http = createHttpSourceProvider({
    resolver: async () => ["93.184.216.34"],
    fetcher: async () => new Response(new Uint8Array(2_048), { status: 200, headers: { "content-type": "text/plain" } })
  });
  await assert.rejects(
    () => http.scan(descriptor("http", "https://example.test/", { allowed_hosts: ["example.test"] }), { ...DEFAULT_SOURCE_BUDGET, max_item_bytes: 1_024 }),
    /http_body_budget_exceeded/
  );

  const rebound = createHttpSourceProvider({ resolver: async () => ["::ffff:127.0.0.1"], fetcher: async () => new Response("must-not-run") });
  await assert.rejects(() => rebound.scan(descriptor("http", "https://example.test/", { allowed_hosts: ["example.test"] }), DEFAULT_SOURCE_BUDGET), /http_private_address_forbidden/);
  const nonGlobalIpv6 = createHttpSourceProvider({ resolver: async () => ["::2"], fetcher: async () => new Response("must-not-run") });
  await assert.rejects(() => nonGlobalIpv6.scan(descriptor("http", "https://example.test/", { allowed_hosts: ["example.test"] }), DEFAULT_SOURCE_BUDGET), /http_private_address_forbidden/);
});

test("HTTP resolution is transport-bound and rejects mapped or rebinding-prone addresses", async () => {
  let fetchCalls = 0;
  const mapped = createHttpSourceProvider({ resolver: async () => ["::ffff:7f00:1"], fetcher: async () => { fetchCalls += 1; return new Response("must-not-run"); } });
  await assert.rejects(() => mapped.scan(descriptor("http", "https://example.test/", { allowed_hosts: ["example.test"] }), DEFAULT_SOURCE_BUDGET), /http_private_address_forbidden/);
  assert.equal(fetchCalls, 0);

  let approvedAddresses = [];
  const bound = createHttpSourceProvider({ resolver: async () => ["93.184.216.34"], fetcher: async (_url, _init, context) => {
    approvedAddresses = context.approved_addresses;
    return new Response("bounded");
  } });
  assert.equal((await bound.scan(descriptor("http", "https://example.test/", { allowed_hosts: ["example.test"] }), DEFAULT_SOURCE_BUDGET))[0].content.byteLength, 7);
  assert.deepEqual(approvedAddresses, ["93.184.216.34"]);

  const tooManyPaths = createHttpSourceProvider({ resolver: async () => { throw new Error("resolver_must_not_run"); }, fetcher: async () => { throw new Error("fetch_must_not_run"); } });
  await assert.rejects(() => tooManyPaths.scan(descriptor("http", "https://example.test/", { allowed_hosts: ["example.test"], paths: ["/a", "/b"] }), { ...DEFAULT_SOURCE_BUDGET, max_items: 1 }), /source_item_budget_exceeded/);
});

test("secret-bearing normalized content is blocked instead of entering proposals", async () => {
  const source = descriptor("filesystem", ".");
  const payload = { key: "notes.md", media_type: "text/markdown", content: Buffer.from("API_TOKEN=super-secret-value-12345") };
  const snapshot = buildSourceSnapshot(source, [payload]);
  const conversion = await convertPayloads(snapshot, [payload], DEFAULT_SOURCE_BUDGET);
  assert.equal(conversion.units.length, 0);
  assert.equal(conversion.diagnostics.some((item) => item.code === "secret_bearing_content_blocked" && item.severity === "blocking"), true);
  assert.equal(JSON.stringify(conversion).includes("super-secret-value-12345"), false);

  const structured = { key: "secret.json", media_type: "application/json", content: Buffer.from('{"name":"demo","token":"short-secret"}') };
  const structuredSnapshot = buildSourceSnapshot(source, [structured]);
  const structuredConversion = await convertPayloads(structuredSnapshot, [structured], DEFAULT_SOURCE_BUDGET);
  assert.equal(structuredConversion.units.length, 0);
  assert.equal(structuredConversion.diagnostics.some((item) => item.code === "secret_bearing_content_blocked"), true);
  assert.equal(JSON.stringify(structuredConversion).includes("short-secret"), false);

  const camelCase = { key: "client.json", media_type: "application/json", content: Buffer.from('{"name":"demo","clientSecret":"do-not-export"}') };
  const camelSnapshot = buildSourceSnapshot(source, [camelCase]);
  const camelConversion = await convertPayloads(camelSnapshot, [camelCase], DEFAULT_SOURCE_BUDGET);
  assert.equal(camelConversion.units.length, 0);
  assert.equal(JSON.stringify(camelConversion).includes("do-not-export"), false);

  const malformed = { key: "broken.yaml", media_type: "application/yaml", content: Buffer.from('OPENAI_API_KEY: "secret-value-12345\nunterminated') };
  const malformedSnapshot = buildSourceSnapshot(source, [malformed]);
  const malformedConversion = await convertPayloads(malformedSnapshot, [malformed], DEFAULT_SOURCE_BUDGET);
  assert.equal(malformedConversion.units.length, 0);
  assert.equal(JSON.stringify(malformedConversion).includes("secret-value-12345"), false);
  assert.equal(malformedConversion.diagnostics[0].message, "converter_parse_or_execution_failed");
});

test("source snapshots reject descriptors that contain prefixed secret fields", () => {
  const unsafe = descriptor("filesystem", ".", { openaiApiKey: "do-not-hash" });
  assert.throws(() => buildSourceSnapshot(unsafe, []), /source_configuration_contains_secret_material/);
});

test("provider and normalization budgets fail before unbounded materialization", async () => {
  let sqlLimit = 0;
  const sql = createSqlSourceProvider("postgres", { read_only: true, query: async (_statement, _params, limits) => {
    sqlLimit = limits.max_rows;
    return [{ id: 1 }, { id: 2 }];
  } }, { records: "SELECT id FROM records" });
  await assert.rejects(() => sql.scan(descriptor("postgres", "database-alias", { query_id: "records" }), { ...DEFAULT_SOURCE_BUDGET, max_items: 1 }), /sql_row_budget_exceeded/);
  assert.equal(sqlLimit, 2);

  const s3 = createS3SourceProvider({
    read_only: true,
    list: async () => [{ key: "public/a.json", etag: "list-etag" }],
    get: async (_bucket, _key, _version, limits) => ({ content: Buffer.from("{}"), etag: "get-etag", version: "version-1", observed_limit: limits.max_bytes })
  });
  const s3Payloads = await s3.scan(descriptor("s3", "bucket-alias", { bucket: "docs", allowed_bucket: "docs", prefix: "public/", allowed_prefix: "public/" }), { ...DEFAULT_SOURCE_BUDGET, max_item_bytes: 32, max_total_bytes: 32 });
  assert.equal(s3Payloads[0].etag, "get-etag");
  assert.equal(s3Payloads[0].version, "version-1");

  const source = descriptor("filesystem", ".");
  const paragraphPayload = { key: "many.md", media_type: "text/markdown", content: Buffer.from("one\n\ntwo\n\nthree") };
  const paragraphSnapshot = buildSourceSnapshot(source, [paragraphPayload]);
  const limited = await convertPayloads(paragraphSnapshot, [paragraphPayload], { ...DEFAULT_SOURCE_BUDGET, max_items: 2 });
  assert.equal(limited.units.length, 0);
  assert.equal(limited.diagnostics.some((item) => item.message === "normalized_unit_budget_exceeded"), true);
});

test("official S3 client rejects invalid budgets and stalled pagination", async () => {
  assert.throws(() => createS3ReadClient({ client: { send: async () => ({}) }, maxObjectBytes: Number.NaN }), /s3_object_budget_invalid/);
  const client = createS3ReadClient({
    client: {
      send: async () => ({ Contents: [], IsTruncated: true, NextContinuationToken: "same-token" })
    }
  });
  await assert.rejects(() => client.list("bucket", "allowed/", 2), /s3_pagination_stalled/);
  await assert.rejects(() => client.list("bucket", "allowed/", 0), /s3_list_budget_invalid/);
});

test("malformed and oversized office archives fail closed before normalization", async () => {
  const source = descriptor("filesystem", ".");
  for (const payload of [
    { key: "broken.docx", media_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", content: Buffer.from("not-a-zip") },
    { key: "broken.xlsx", media_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", content: Buffer.from("not-a-zip") }
  ]) {
    const snapshot = buildSourceSnapshot(source, [payload]);
    const conversion = await convertPayloads(snapshot, [payload], DEFAULT_SOURCE_BUDGET);
    assert.equal(conversion.units.length, 0);
    assert.equal(conversion.diagnostics.some((item) => item.code === "conversion_failed" && item.severity === "blocking"), true);
  }

  const bomb = zipSync({ "word/document.xml": strToU8("x".repeat(50_000)) }, { level: 9 });
  const payload = { key: "ratio.docx", media_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", content: bomb };
  const snapshot = buildSourceSnapshot(source, [payload]);
  const conversion = await convertPayloads(snapshot, [payload], { ...DEFAULT_SOURCE_BUDGET, max_item_bytes: 100_000, max_total_bytes: 100_000 });
  assert.equal(conversion.units.length, 0);
  assert.equal(conversion.diagnostics.some((item) => item.message === "archive_compression_ratio_exceeded"), true);
});
