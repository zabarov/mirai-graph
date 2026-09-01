const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const { assimilateCatalog, scanSource } = require("../../dist/cjs/assimilation");

test("source scan is deterministic, excludes secrets and preserves provenance", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-assimilation-"));
  try {
    fs.writeFileSync(path.join(root, "a.md"), "# A\n");
    fs.writeFileSync(path.join(root, "copy.md"), "# A\n");
    fs.writeFileSync(path.join(root, "graph.json"), JSON.stringify({ objects: [{ id: "goal.demo", kind: "goal", title: "Demo goal" }], relations: [{ id: "relation.demo", type: "advances" }] }));
    fs.writeFileSync(path.join(root, ".env"), "TOKEN=must-not-leak\n");
    spawnSync("git", ["init", "-q", root]);
    spawnSync("git", ["-C", root, "remote", "add", "origin", "https://secret-user:secret-token@example.test/project.git?token=hidden"]);
    const first = scanSource(root);
    const second = scanSource(root);
    assert.equal(first.digest, second.digest);
    assert.equal(first.canonical_write_allowed, false);
    assert.equal(first.items.some((item) => item.path === ".env"), false);
    assert.equal(JSON.stringify(first).includes("must-not-leak"), false);
    assert.equal(JSON.stringify(first).includes("secret-token"), false);
    assert.equal(first.items.some((item) => item.extracted_candidates.some((candidate) => candidate.kind === "relation")), true);
    const proposal = assimilateCatalog(first);
    assert.equal(proposal.exact_duplicates.length, 1);
    assert.equal(proposal.canonical_write_allowed, false);
    assert.equal(proposal.quality.provenance_coverage, 1);
    assert.equal(proposal.candidate_assertions.some((item) => item.kind === "relation"), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("conflicting source versions are never silently merged", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-conflict-"));
  try {
    fs.writeFileSync(path.join(root, "policy.md"), "version one\n");
    fs.writeFileSync(path.join(root, "policy.txt"), "version two\n");
    const proposal = assimilateCatalog(scanSource(root));
    assert.equal(proposal.conflicts.length, 1);
    assert.equal(proposal.conflicts[0].resolution, "owner_review_required");
    assert.equal(proposal.quality.readiness, "blocked");
    assert.equal(proposal.next_safe_action, "resolve_blocking_diagnostics");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
