"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_MODEL = "Xenova/multilingual-e5-small";
const DEFAULT_DIMENSIONS = 384;
const DEFAULT_REVISION = "761b70121b0496ee46b2a24bd4a65b7c94b3d6a0";

function digestDirectory(root) {
  const hash = crypto.createHash("sha256");
  function walk(directory) {
    for (const name of fs.readdirSync(directory).sort()) {
      const filename = path.join(directory, name);
      const item = fs.lstatSync(filename);
      if (item.isSymbolicLink()) throw new Error("embedding_cache_symlink_rejected");
      if (item.isDirectory()) walk(filename);
      else if (item.isFile()) {
        if (name === "mirai-model-receipt.json") continue;
        const relative = Buffer.from(path.relative(root, filename), "utf8");
        const content = fs.readFileSync(filename);
        hash.update(Buffer.from(`${relative.length}:`, "ascii"));
        hash.update(relative);
        hash.update(Buffer.from(`${content.length}:`, "ascii"));
        hash.update(content);
      }
    }
  }
  walk(root);
  return `sha256:${hash.digest("hex")}`;
}

function createLocalEmbeddingProvider(options = {}) {
  const model = options.model || DEFAULT_MODEL;
  const dimensions = options.dimensions || DEFAULT_DIMENSIONS;
  const cacheDir = path.resolve(options.cache_dir || path.join(process.env.MIRAI_HOME || path.join(process.env.HOME || ".", ".mirai"), "models"));
  const allowDownload = options.allow_download === true;
  const revision = options.revision || DEFAULT_REVISION;
  const expectedFilesDigest = options.expected_files_digest;
  if (!revision) throw new Error("embedding_revision_required");
  let extractor;
  return {
    id: "huggingface-transformers-local",
    model,
    dimensions,
    revision,
    files_digest: expectedFilesDigest,
    async embed(texts) {
      if (!Array.isArray(texts) || texts.some((value) => typeof value !== "string")) throw new Error("embedding_text_array_required");
      if (!allowDownload) {
        if (!expectedFilesDigest) throw new Error("embedding_expected_files_digest_required");
        if (!fs.existsSync(cacheDir) || digestDirectory(cacheDir) !== expectedFilesDigest) throw new Error("embedding_cache_digest_mismatch");
      }
      const transformers = await import("@huggingface/transformers");
      transformers.env.cacheDir = cacheDir;
      transformers.env.allowRemoteModels = allowDownload;
      const localModelPath = revision ? path.join(cacheDir, ...model.split("/"), revision) : undefined;
      const modelTarget = !allowDownload && localModelPath && fs.existsSync(localModelPath) ? localModelPath : model;
      extractor ||= await transformers.pipeline("feature-extraction", modelTarget, { cache_dir: cacheDir, local_files_only: !allowDownload, ...(allowDownload && revision ? { revision } : {}) });
      const output = await extractor(texts, { pooling: "mean", normalize: true });
      const vectors = output.tolist();
      if (!Array.isArray(vectors) || vectors.length !== texts.length || vectors.some((vector) => !Array.isArray(vector) || vector.length !== dimensions)) throw new Error("embedding_model_dimension_mismatch");
      return vectors;
    }
  };
}

async function prepareLocalEmbeddingModel(options = {}) {
  if (options.allow_download !== true) throw new Error("embedding_download_requires_explicit_allow_download");
  if (!options.revision) throw new Error("embedding_revision_required_for_download");
  const cacheDir = path.resolve(options.cache_dir);
  fs.mkdirSync(cacheDir, { recursive: true, mode: 0o700 });
  const provider = createLocalEmbeddingProvider({ ...options, cache_dir: cacheDir, allow_download: true });
  await provider.embed(["query: Mirai retrieval model preparation"]);
  const receipt = {
    contract_version: "1.0.0",
    provider: provider.id,
    model: provider.model,
    revision: options.revision,
    dimensions: provider.dimensions,
    cache_path: cacheDir,
    files_digest: digestDirectory(cacheDir),
    model_card_url: options.model_card_url || `https://huggingface.co/${provider.model}`,
    license: options.license || "model-card-review-required",
    prepared_at: new Date().toISOString(),
    remote_download_was_explicit: true,
    canonical_write_allowed: false
  };
  fs.writeFileSync(path.join(cacheDir, "mirai-model-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  return receipt;
}

module.exports = { createLocalEmbeddingProvider, prepareLocalEmbeddingModel, digestDirectory, DEFAULT_MODEL, DEFAULT_DIMENSIONS, DEFAULT_REVISION };
