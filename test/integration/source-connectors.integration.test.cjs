"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { CreateBucketCommand, PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { DEFAULT_SOURCE_BUDGET, buildSourceSnapshot } = require("../../dist/cjs/sources");
const { createHttpSourceProvider } = require("../../packages/source-http");
const { createPostgresSourceProvider } = require("../../packages/source-postgres");
const { createMysqlSourceProvider } = require("../../packages/source-mysql");
const { createS3SourceProvider } = require("../../packages/source-s3");

const requiredEnvironment = [
  "MIRAI_TEST_HTTP_URL",
  "MIRAI_TEST_POSTGRES_URL",
  "MIRAI_TEST_MYSQL_URL",
  "MIRAI_TEST_S3_ENDPOINT",
  "MIRAI_TEST_S3_ACCESS_KEY",
  "MIRAI_TEST_S3_SECRET_KEY"
];
const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]);

function descriptor(provider, locator, configuration, connectionRef) {
  return {
    contract_version: "1.0.0",
    id: `integration.${provider}`,
    provider,
    locator,
    authority: "owner_asserted",
    scope: "isolated_connector_integration",
    confidentiality: "internal",
    freshness: {},
    read_only: true,
    configuration,
    ...(connectionRef ? { connection_ref: connectionRef } : {})
  };
}

test("official HTTP, PostgreSQL, MySQL and S3 connectors read bounded synthetic sources", {
  skip: missingEnvironment.length ? `missing integration environment: ${missingEnvironment.join(",")}` : false,
  timeout: 90_000
}, async () => {
  const httpUrl = new URL(process.env.MIRAI_TEST_HTTP_URL);
  const httpProvider = createHttpSourceProvider();
  const httpPayloads = await httpProvider.scan(
    descriptor("http", httpUrl.origin, { allowed_hosts: [httpUrl.hostname], paths: [httpUrl.pathname || "/"], max_redirects: 2 }),
    { ...DEFAULT_SOURCE_BUDGET, max_items: 2, max_item_bytes: 256_000, max_total_bytes: 256_000 }
  );
  assert.equal(httpPayloads.length, 1);
  assert.equal(httpPayloads[0].content.byteLength > 0, true);

  const postgresProvider = createPostgresSourceProvider(
    { connectionString: process.env.MIRAI_TEST_POSTGRES_URL, maxConnections: 1 },
    { records: "SELECT id, name FROM source_records WHERE id >= $1 ORDER BY id" }
  );
  try {
    const payloads = await postgresProvider.scan(
      descriptor("postgres", "connection-alias:mirai-integration-postgres", { query_id: "records", params: [1] }, "mirai_integration_postgres"),
      { ...DEFAULT_SOURCE_BUDGET, max_items: 10 }
    );
    assert.deepEqual(payloads.map((item) => JSON.parse(item.content.toString()).name), ["alpha", "beta"]);
    assert.equal(buildSourceSnapshot(descriptor("postgres", "connection-alias:mirai-integration-postgres", { query_id: "records", params: [1] }, "mirai_integration_postgres"), payloads).canonical_write_allowed, false);
  } finally {
    await postgresProvider.close();
  }

  const mysqlProvider = createMysqlSourceProvider(
    { connectionUri: process.env.MIRAI_TEST_MYSQL_URL, maxConnections: 1 },
    { records: "SELECT id, name FROM source_records WHERE id >= ? ORDER BY id" }
  );
  try {
    const payloads = await mysqlProvider.scan(
      descriptor("mysql", "connection-alias:mirai-integration-mysql", { query_id: "records", params: [1] }, "mirai_integration_mysql"),
      { ...DEFAULT_SOURCE_BUDGET, max_items: 10 }
    );
    assert.deepEqual(payloads.map((item) => JSON.parse(item.content.toString()).name), ["alpha", "beta"]);
  } finally {
    await mysqlProvider.close();
  }

  const s3ClientConfig = {
    endpoint: process.env.MIRAI_TEST_S3_ENDPOINT,
    region: "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.MIRAI_TEST_S3_ACCESS_KEY,
      secretAccessKey: process.env.MIRAI_TEST_S3_SECRET_KEY
    }
  };
  const setupClient = new S3Client(s3ClientConfig);
  const bucket = "mirai-integration";
  try {
    try { await setupClient.send(new CreateBucketCommand({ Bucket: bucket })); } catch (error) {
      if (!["BucketAlreadyOwnedByYou", "BucketAlreadyExists"].includes(error.name)) throw error;
    }
    await setupClient.send(new PutObjectCommand({ Bucket: bucket, Key: "allowed/sample.json", Body: Buffer.from('{"id":1,"name":"alpha"}') }));
  } finally {
    setupClient.destroy();
  }

  const s3Provider = createS3SourceProvider({ clientConfig: s3ClientConfig, maxObjectBytes: 64_000 });
  try {
    const payloads = await s3Provider.scan(
      descriptor("s3", "connection-alias:mirai-integration-s3", { bucket, allowed_bucket: bucket, prefix: "allowed/", allowed_prefix: "allowed/" }, "mirai_integration_s3"),
      { ...DEFAULT_SOURCE_BUDGET, max_items: 10, max_item_bytes: 64_000, max_total_bytes: 64_000 }
    );
    assert.deepEqual(payloads.map((item) => item.key), ["allowed/sample.json"]);
    assert.equal(JSON.parse(Buffer.from(payloads[0].content).toString("utf8")).name, "alpha");
  } finally {
    await s3Provider.close();
  }
});
