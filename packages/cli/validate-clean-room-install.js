#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const npmCli = process.env.npm_execpath;

if (!npmCli || !fs.existsSync(npmCli)) {
  process.stderr.write("npm_execpath is required for a portable clean-room install check.\n");
  process.exit(1);
}

function runNode(args, options = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: options.cwd || root,
    encoding: "utf8",
    env: { ...process.env, npm_config_audit: "false", npm_config_fund: "false",
      npm_config_cache: process.env.MIRAI_NPM_CACHE || path.join(temp, "npm-cache") }
  });
  if (result.status !== 0) {
    throw new Error(`${options.label || args.join(" ")} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-clean-room-"));
let tarball;
try {
  const packOutput = runNode([npmCli, "pack", "--json", "--silent"], { label: "npm pack" });
  const pack = JSON.parse(packOutput);
  const localStateEntries = (pack[0].files || [])
    .map((entry) => entry.path)
    .filter((entryPath) => entryPath === ".mirai" || entryPath.startsWith(".mirai/") || entryPath.includes("/.mirai/"));
  if (localStateEntries.length > 0) {
    throw new Error(`host-local .mirai state was packaged: ${localStateEntries.join(", ")}`);
  }
  tarball = path.join(root, pack[0].filename);
  fs.writeFileSync(path.join(temp, "package.json"), JSON.stringify({ private: true }, null, 2));
  runNode([npmCli, "install", "--ignore-scripts", tarball], { cwd: temp, label: "npm install tarball" });

  fs.writeFileSync(
    path.join(temp, "consumer.cjs"),
    "const program = require('@zabarov/mirai/program');\n" +
      "const runtime = require('@zabarov/mirai/runtime');\n" +
      "if (typeof program.compileProgramFile !== 'function') throw new Error('missing CJS compiler');\n" +
      "if (typeof runtime.startGovernedRun !== 'function') throw new Error('missing CJS runtime');\n"
  );
  runNode([path.join(temp, "consumer.cjs")], { cwd: temp, label: "CommonJS consumer" });

  fs.writeFileSync(
    path.join(temp, "consumer.mjs"),
    "import { compileProgramFile } from '@zabarov/mirai/program';\n" +
    "import { startGovernedRun } from '@zabarov/mirai/runtime';\n" +
      "if (typeof compileProgramFile !== 'function') throw new Error('missing ESM compiler');\n" +
      "if (typeof startGovernedRun !== 'function') throw new Error('missing ESM runtime');\n"
  );
  runNode([path.join(temp, "consumer.mjs")], { cwd: temp, label: "ESM consumer" });

  const installedRoot = path.join(temp, "node_modules", "@zabarov", "mirai");
  const metadata = JSON.parse(fs.readFileSync(path.join(installedRoot, "package.json"), "utf8"));
  for (const alias of ["mirai", "mirai-graph", "mirai_graph"]) {
    if (metadata.bin?.[alias] !== "packages/cli/mirai.js") throw new Error(`missing CLI alias: ${alias}`);
  }
  const version = runNode([path.join(installedRoot, "packages/cli/mirai.js"), "--version"], {
    cwd: temp,
    label: "installed CLI"
  }).trim();
  if (version !== metadata.version) throw new Error(`CLI version mismatch: ${version} != ${metadata.version}`);

  process.stdout.write(`${JSON.stringify({
    valid: true,
    package: metadata.name,
    version: metadata.version,
    commonjs: true,
    esm: true,
    cli_aliases: ["mirai", "mirai-graph", "mirai_graph"]
  }, null, 2)}\n`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
  if (tarball) fs.rmSync(tarball, { force: true });
}
