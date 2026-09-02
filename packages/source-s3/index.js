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
  if (!(Symbol.asyncIterator in Object(body))) throw new Error("s3_streaming_body_required");
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
  const configuredMaxObjectBytes = Number(options.maxObjectBytes ?? 10 * 1024 * 1024);
  if (!Number.isSafeInteger(configuredMaxObjectBytes) || configuredMaxObjectBytes < 1) throw new Error("s3_object_budget_invalid");
  const maxObjectBytes = configuredMaxObjectBytes;
  return {
    read_only: true,
    async list(bucket, prefix, limit, limits = {}) {
      if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("s3_list_budget_invalid");
      const objects = [];
      let continuationToken;
      const seenTokens = new Set();
      let pageCount = 0;
      const maxPages = Math.min(limit + 1, 10_000);
      do {
        pageCount += 1;
        if (pageCount > maxPages) throw new Error("s3_pagination_budget_exceeded");
        const result = await client.send(new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          MaxKeys: Math.min(1000, limit - objects.length),
          ...(continuationToken ? { ContinuationToken: continuationToken } : {})
        }), limits.signal ? { abortSignal: limits.signal } : undefined);
        for (const object of result.Contents || []) {
          if (!object.Key) continue;
          objects.push({ key: object.Key, etag: object.ETag, bytes: object.Size });
          if (objects.length >= limit) break;
        }
        continuationToken = objects.length < limit && result.IsTruncated ? result.NextContinuationToken : undefined;
        if (result.IsTruncated && objects.length < limit && !continuationToken) throw new Error("s3_pagination_token_missing");
        if (continuationToken && seenTokens.has(continuationToken)) throw new Error("s3_pagination_stalled");
        if (continuationToken) seenTokens.add(continuationToken);
      } while (continuationToken);
      return objects;
    },
    async get(bucket, key, version, limits = {}) {
      const requestLimit = Math.max(1, Number(limits.max_bytes || maxObjectBytes));
      const effectiveLimit = Math.min(maxObjectBytes, requestLimit);
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key, ...(version ? { VersionId: version } : {}) }), limits.signal ? { abortSignal: limits.signal } : undefined);
      if (Number(result.ContentLength || 0) > effectiveLimit) throw new Error("s3_body_budget_exceeded");
      return {
        content: await bodyToBytes(result.Body, effectiveLimit),
        ...(result.ETag ? { etag: result.ETag } : {}),
        ...(result.VersionId ? { version: result.VersionId } : {})
      };
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
