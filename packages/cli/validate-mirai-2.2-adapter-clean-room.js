#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-adapter-clean-room-"));
const artifacts = path.join(temporaryRoot, "artifacts");
const consumer = path.join(temporaryRoot, "consumer");
fs.mkdirSync(artifacts);
fs.mkdirSync(consumer);
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("npm_execpath_required");

function npm(args, cwd) {
  const result = spawnSync(process.execPath, [npmCli, ...args], { cwd, encoding: "utf8", timeout: 180_000 });
  if (result.status !== 0) throw new Error(`npm_failed:${args.join(" ")}:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

function pack(target) {
  const localTarget = target === "." ? target : `./${target}`;
  const output = npm(["pack", localTarget, "--json", "--pack-destination", artifacts], root);
  const report = JSON.parse(output);
  assert.equal(report.length, 1);
  return path.join(artifacts, report[0].filename);
}

try {
  const tarballs = [
    pack("."),
    pack("packages/source-http"),
    pack("packages/source-postgres"),
    pack("packages/source-mysql"),
    pack("packages/source-s3")
  ];
  fs.writeFileSync(path.join(consumer, "package.json"), `${JSON.stringify({ private: true }, null, 2)}\n`);
  npm(["install", "--ignore-scripts", "--no-audit", "--no-fund", ...tarballs], consumer);
  const factories = {
    "@zabarov/mirai-source-http": ["createHttpSourceProvider"],
    "@zabarov/mirai-source-postgres": ["createPostgresReadClient", "createPostgresSourceProvider"],
    "@zabarov/mirai-source-mysql": ["createMysqlReadClient", "createMysqlSourceProvider"],
    "@zabarov/mirai-source-s3": ["createS3ReadClient", "createS3SourceProvider"]
  };
  for (const [packageName, names] of Object.entries(factories)) {
    const implementation = require(require.resolve(packageName, { paths: [consumer] }));
    for (const name of names) assert.equal(typeof implementation[name], "function", `${packageName}:${name}`);
  }
  process.stdout.write(`${JSON.stringify({ status: "passed", package_count: tarballs.length, clean_room_install: true }, null, 2)}\n`);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
