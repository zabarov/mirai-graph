#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const source = path.join(root, "schemas/mirai-program.schema.json");
const target = path.join(root, "src/program/schema.ts");
const schema = JSON.parse(fs.readFileSync(source, "utf8"));
const generated = [
  "// Generated from schemas/mirai-program.schema.json. Do not edit by hand.",
  `export const MIRAI_PROGRAM_SCHEMA = ${JSON.stringify(schema, null, 2)} as const;`,
  ""
].join("\n");

if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== generated) {
  fs.writeFileSync(target, generated);
}
