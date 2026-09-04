"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

function included(relative) {
  return relative === "package-lock.json"
    || relative.startsWith("src/retrieval/")
    || relative.startsWith("packages/embedding-local/")
    || relative.startsWith("test/retrieval/")
    || /^schemas\/(?:retrieval|federated-query).+\.schema\.json$/u.test(relative)
    || relative === "packages/cli/validate-mirai-2.4-evaluation.js"
    || ["corpus.json", "generate-corpus.js", "implementation-lock.js", "run-evaluation.js"].includes(relative.replace("benchmarks/mirai-2.4-retrieval/", ""));
}

function implementationSurface(root) {
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: root })
    .toString("utf8").split("\0").filter(Boolean).filter(included).sort();
  const hash = crypto.createHash("sha256");
  for (const relative of files) {
    const content = fs.readFileSync(path.join(root, relative));
    const name = Buffer.from(relative, "utf8");
    hash.update(Buffer.from(`${name.length}:`, "ascii"));
    hash.update(name);
    hash.update(Buffer.from(`${content.length}:`, "ascii"));
    hash.update(content);
  }
  return { files, digest: `sha256:${hash.digest("hex")}` };
}

module.exports = { implementationSurface };
