#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const [targetArg, ...required] = process.argv.slice(2);
if (!targetArg || required.length === 0) {
  process.stderr.write("Usage: assert-file-contains.js <file> <required-text> [...]\n");
  process.exit(2);
}

const target = path.resolve(targetArg);
const content = fs.readFileSync(target, "utf8");
const missing = required.filter((value) => !content.includes(value));
if (missing.length > 0) {
  process.stderr.write(`missing required output text: ${missing.join(" | ")}\n`);
  process.exit(1);
}

process.stdout.write(`${JSON.stringify({ valid: true, checked: required.length }, null, 2)}\n`);
