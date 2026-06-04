#!/usr/bin/env node

const { spawnSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const node = process.execPath;
const releaseState = path.join(root, "packages", "cli", "release-state.js");

const result = spawnSync(node, [releaseState], {
  cwd: root,
  encoding: "utf8"
});

const errors = [];
let state = null;

if (result.status !== 0) {
  errors.push(`release-state command failed with exit ${result.status}`);
}

try {
  state = JSON.parse(result.stdout);
} catch (error) {
  errors.push("release-state output is not valid JSON");
}

if (state) {
  if (state.report_type !== "mirai_graph_release_state") {
    errors.push("unexpected report_type");
  }
  if (!state.package || state.package.name !== "mirai-graph") {
    errors.push("package name must be mirai-graph");
  }
  if (!state.package || !state.package.version) {
    errors.push("package version is required");
  }
  if (!state.git || !state.git.tag_exists) {
    errors.push("current package version must have a local git tag");
  }
  if (!state.github_release || !state.github_release.found) {
    errors.push("matching GitHub Release must exist");
  }
  if (!state.npm || !state.npm.package || typeof state.npm.package.version_published !== "boolean") {
    errors.push("npm package publication state must be reported");
  }
  if (!state.npm || typeof state.npm.authenticated !== "boolean") {
    errors.push("npm authentication state must be reported");
  }
  if (!Array.isArray(state.blockers)) {
    errors.push("blockers must be an array");
  }
  if (!Array.isArray(state.boundary) || !state.boundary.some((item) => item.includes("does not publish"))) {
    errors.push("release-state boundary must state that the report does not publish");
  }
}

const markdown = spawnSync(node, [releaseState, "--markdown"], {
  cwd: root,
  encoding: "utf8"
});

if (markdown.status !== 0) {
  errors.push(`release-state markdown command failed with exit ${markdown.status}`);
} else {
  for (const expected of ["Mirai Graph Release State", "GitHub Release", "NPM Package", "Blockers"]) {
    if (!markdown.stdout.includes(expected)) {
      errors.push(`markdown report missing ${expected}`);
    }
  }
}

const validation = {
  mode: "release_state",
  valid: errors.length === 0,
  checked_version: state && state.package && state.package.version || null,
  npm_version_published: state && state.npm && state.npm.package && state.npm.package.version_published,
  npm_authenticated: state && state.npm && state.npm.authenticated,
  blockers: state && state.blockers || [],
  errors
};

console.log(JSON.stringify(validation, null, 2));

if (errors.length > 0) {
  process.exit(1);
}
