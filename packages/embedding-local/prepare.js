#!/usr/bin/env node
"use strict";

const path = require("node:path");
const { prepareLocalEmbeddingModel } = require("./index.js");

const args = process.argv.slice(2);
const value = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
if (args[0] !== "prepare" || !args.includes("--allow-download")) {
  process.stderr.write("Usage: mirai-embedding-local prepare --allow-download --cache <dir> [--model <id>] [--license <spdx>]\n");
  process.exit(1);
}
prepareLocalEmbeddingModel({
  allow_download: true,
  cache_dir: path.resolve(value("--cache") || path.join(process.env.MIRAI_HOME || path.join(process.env.HOME || ".", ".mirai"), "models")),
  ...(value("--model") ? { model: value("--model") } : {}),
  ...(value("--license") ? { license: value("--license") } : {})
}).then((receipt) => process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`), (error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
