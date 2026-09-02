#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const roots = [
  "README.md", "ROADMAP.md", "CHANGELOG.md", "CONTRIBUTING.md",
  "docs", "standard", "examples", "profiles", "pilots", "playground",
  "publications", "releases", "templates", "conformance", "packages"
];
const files = [];

function walk(target) {
  if (!fs.existsSync(target)) return;
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    if (target.endsWith(".md")) files.push(target);
    return;
  }
  for (const entry of fs.readdirSync(target, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (["node_modules", ".git", "dist", "source", ".mirai"].includes(entry.name)) continue;
    walk(path.join(target, entry.name));
  }
}

roots.forEach((entry) => walk(path.join(root, entry)));
const errors = [];
const expression = /!?\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
for (const filename of [...new Set(files)].sort()) {
  const text = fs.readFileSync(filename, "utf8");
  for (const match of text.matchAll(expression)) {
    let target = match[1];
    if (target.startsWith("<") && target.endsWith(">")) target = target.slice(1, -1);
    if (!target || target.startsWith("#") || /^(?:https?:|mailto:|data:|codex:)/i.test(target)) continue;
    target = target.split("#")[0].split("?")[0];
    try { target = decodeURIComponent(target); } catch { errors.push(`${path.relative(root, filename)}:invalid_url_encoding:${target}`); continue; }
    const resolved = target.startsWith("/") ? path.join(root, target.slice(1)) : path.resolve(path.dirname(filename), target);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) errors.push(`${path.relative(root, filename)}:link_outside_repository:${target}`);
    else if (!fs.existsSync(resolved)) errors.push(`${path.relative(root, filename)}:missing:${target}`);
  }
}

const valid = errors.length === 0;
process.stdout.write(`${JSON.stringify({ valid, markdown_file_count: files.length, errors }, null, 2)}\n`);
process.exitCode = valid ? 0 : 1;
