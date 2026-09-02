"use strict";

const { GetObjectCommand, ListObjectsV2Command, S3Client } = require("@aws-sdk/client-s3");

function sources() {
  try { return require("@zabarov/mirai/sources"); }
  catch (error) {
    if (error && error.code !== "MODULE_NOT_FOUND") throw error;
    return require("../../dist/cjs/sources/index.js");
  }
}

async function bodyToBytes(body, maxBytes) {
  if (!body) return new Uint8Array();
  if (typeof body.transformToByteArray === "function") {
    const bytes = await body.transformToByteArray();
    if (bytes.byteLength > maxBytes) throw new Error("s3_body_budget_exceeded");
    return bytes;
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of body) {
    const bytes = chunk instanceof Uint8Array ? chunk : Buffer.from(chunk);
    total += bytes.byteLength;
    if (total > maxBytes) throw new Error("s3_body_budget_exceeded");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, total);
}

function createS3ReadClient(options = {}) {
  const externalClient = options.client;
  const client = externalClient || new S3Client(options.clientConfig || {});
  const maxObjectBytes = Math.max(1, Number(options.maxObjectBytes || 10 * 1024 * 1024));
  return {
    read_only: true,
    async list(bucket, prefix, limit) {
      const objects = [];
      let continuationToken;
      do {
        const result = await client.send(new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          MaxKeys: Math.min(1000, limit - objects.length),
          ...(continuationToken ? { ContinuationToken: continuationToken } : {})
        }));
        for (const object of result.Contents || []) {
          if (!object.Key) continue;
          objects.push({ key: object.Key, etag: object.ETag, bytes: object.Size });
          if (objects.length >= limit) break;
        }
        continuationToken = objects.length < limit && result.IsTruncated ? result.NextContinuationToken : undefined;
      } while (continuationToken);
      return objects;
    },
    async get(bucket, key, version) {
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key, ...(version ? { VersionId: version } : {}) }));
      if (Number(result.ContentLength || 0) > maxObjectBytes) throw new Error("s3_body_budget_exceeded");
      return bodyToBytes(result.Body, maxObjectBytes);
    },
    async close() {
      if (!externalClient) client.destroy();
    }
  };
}

function createS3SourceProvider(clientOrOptions = {}) {
  const client = clientOrOptions && clientOrOptions.read_only === true && typeof clientOrOptions.list === "function"
    ? clientOrOptions
    : createS3ReadClient(clientOrOptions);
  const provider = sources().createS3SourceProvider(client);
  return Object.assign(provider, {
    close: async () => { if (typeof client.close === "function") await client.close(); }
  });
}

module.exports = { createS3ReadClient, createS3SourceProvider };
