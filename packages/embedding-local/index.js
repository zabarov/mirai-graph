"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_MODEL = "Xenova/multilingual-e5-small";
const DEFAULT_DIMENSIONS = 384;

function digestDirectory(root) {
  const hash = crypto.createHash("sha256");
  function walk(directory) {
    for (const name of fs.readdirSync(directory).sort()) {
      const filename = path.join(directory, name);
      const item = fs.lstatSync(filename);
      if (item.isSymbolicLink()) throw new Error("embedding_cache_symlink_rejected");
      if (item.isDirectory()) walk(filename);
      else if (item.isFile()) {
        hash.update(path.relative(root, filename));
        hash.update(fs.readFileSync(filename));
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
  let extractor;
  return {
    id: "huggingface-transformers-local",
    model,
    dimensions,
    async embed(texts) {
      if (!Array.isArray(texts) || texts.some((value) => typeof value !== "string")) throw new Error("embedding_text_array_required");
      const transformers = await import("@huggingface/transformers");
      transformers.env.cacheDir = cacheDir;
      transformers.env.allowRemoteModels = allowDownload;
      extractor ||= await transformers.pipeline("feature-extraction", model, { cache_dir: cacheDir, local_files_only: !allowDownload });
      const output = await extractor(texts, { pooling: "mean", normalize: true });
      const vectors = output.tolist();
      if (!Array.isArray(vectors) || vectors.length !== texts.length || vectors.some((vector) => !Array.isArray(vector) || vector.length !== dimensions)) throw new Error("embedding_model_dimension_mismatch");
      return vectors;
    }
  };
}

async function prepareLocalEmbeddingModel(options = {}) {
  if (options.allow_download !== true) throw new Error("embedding_download_requires_explicit_allow_download");
  const cacheDir = path.resolve(options.cache_dir);
  fs.mkdirSync(cacheDir, { recursive: true, mode: 0o700 });
  const provider = createLocalEmbeddingProvider({ ...options, cache_dir: cacheDir, allow_download: true });
  await provider.embed(["query: Mirai retrieval model preparation"]);
  const receipt = {
    contract_version: "1.0.0",
    provider: provider.id,
    model: provider.model,
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

module.exports = { createLocalEmbeddingProvider, prepareLocalEmbeddingModel, digestDirectory, DEFAULT_MODEL, DEFAULT_DIMENSIONS };
