#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const rootPackage = require(path.join(root, "package.json"));
const packages = [
  ["source-http", "@zabarov/mirai-source-http", ["createHttpSourceProvider"], {}],
  ["source-postgres", "@zabarov/mirai-source-postgres", ["createPostgresReadClient", "createPostgresSourceProvider"], { pg: "^8.16.3" }],
  ["source-mysql", "@zabarov/mirai-source-mysql", ["createMysqlReadClient", "createMysqlSourceProvider"], { mysql2: "^3.15.3" }],
  ["source-s3", "@zabarov/mirai-source-s3", ["createS3ReadClient", "createS3SourceProvider"], { "@aws-sdk/client-s3": "3.1100.0" }]
];
const stable = !rootPackage.version.includes("-");
const [major, minor] = rootPackage.version.split(".").map(Number);
const expectedPeerRange = stable ? ">=2.2.0 <3" : null;

for (const [directory, name, factories, dependencies] of packages) {
  const packageRoot = path.join(root, "packages", directory);
  const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  assert.equal(manifest.name, name);
  const [adapterMajor, adapterMinor] = manifest.version.split(".").map(Number);
  if (stable) {
    assert.equal(manifest.version, rootPackage.version);
    assert.equal(manifest.peerDependencies?.["@zabarov/mirai"], expectedPeerRange);
  } else {
    // An additive core prerelease does not force republishing unchanged stable
    // adapters. Stable publication restores exact version synchronization.
    assert.equal(adapterMajor, major);
    assert.ok(adapterMinor >= 2 && adapterMinor <= minor);
    assert.equal(typeof manifest.peerDependencies?.["@zabarov/mirai"], "string");
  }
  assert.deepEqual(manifest.dependencies || {}, dependencies);
  assert.deepEqual(manifest.files, ["index.js"]);
  assert.equal(manifest.engines?.node, ">=20 <25");
  const implementation = require(path.join(packageRoot, manifest.main));
  for (const factory of factories) assert.equal(typeof implementation[factory], "function");
}

process.stdout.write(`${JSON.stringify({ status: "passed", package_count: packages.length, root_version: rootPackage.version, external_writes: false }, null, 2)}\n`);
