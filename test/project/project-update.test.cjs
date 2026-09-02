const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const project = require("../../dist/cjs/project");
const { digestValue } = require("../../dist/cjs/core");
const continuity = require("../../packages/project-technology/continuity");
const technology = require("../../packages/project-technology");
const OBJECTS = "mirai/graph/objects.json";
const PENDING = ".mirai/project-update.pending.json";
const EXPIRY = "2099-01-01T00:00:00.000Z";

function fixture(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-update-test-"));
  project.initProjectCapsule(root);
  try { return fn(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
function file(root, ref) { return path.join(root, ref); }
function snapshot(root) {
  const records = {};
  function walk(ref) {
    const p = file(root, ref);
    if (!fs.existsSync(p)) return;
    if (fs.lstatSync(p).isDirectory()) fs.readdirSync(p).sort().forEach((n) => walk(`${ref}/${n}`));
    else records[ref] = fs.readFileSync(p).toString("base64");
  }
  walk("mirai"); walk("graph.json");
  return records;
}
function proposal(root) {
  const objects = JSON.parse(fs.readFileSync(file(root, OBJECTS)));
  objects.push({ id: "evidence.synthetic", kind: "evidence", summary: "Synthetic check" });
  return project.prepareProjectUpdate(root, { [OBJECTS]: `${JSON.stringify(objects)}\n` });
}
function host(p, on_checkpoint) {
  // This simulates an out-of-band host registry containing one exact grant.
  return { verify_approval: (request) => request.proposal_digest === p.digest && request.project_binding === p.project_binding
    ? { approval_id: "synthetic.owner", ...request, expires_at: EXPIRY } : null, on_checkpoint };
}
function interrupted(root, p, point, extra) {
  assert.throws(() => project.applyProjectUpdate(root, p, host(p, (step) => {
    if (step === point) { extra?.(); throw new Error("injected_crash"); }
  })), /injected_crash/);
}

test("prepare is deterministic and leaves project and local state untouched", () => fixture((root) => {
  const before = snapshot(root);
  const a = proposal(root); const b = proposal(root);
  assert.deepEqual(a, b);
  assert.equal(a.canonical_write_allowed, false);
  assert.deepEqual(snapshot(root), before);
  assert.equal(fs.existsSync(file(root, ".mirai")), false);
}));

test("approved update keeps lock/facade/START consistent and retries without writes", () => fixture((root) => {
  const p = proposal(root);
  const result = project.applyProjectUpdate(root, p, host(p));
  assert.equal(result.changed, true);
  assert.equal(result.receipt.outcome, "committed");
  assert.equal(project.validateProjectCapsule(root).valid, true);
  assert.equal(project.detectProjectCapsule(root).status, "current");
  assert.equal(fs.existsSync(file(root, "graph")), false);
  assert.deepEqual(snapshot(root), p.after);
  const mtime = fs.statSync(file(root, OBJECTS)).mtimeMs;
  assert.equal(project.applyProjectUpdate(root, p, host(p)).changed, false);
  assert.equal(fs.statSync(file(root, OBJECTS)).mtimeMs, mtime);
}));

for (const [name, makeHost] of [
  ["missing verifier", () => ({})],
  ["serialized approved flag", () => ({ approved: true })],
  ["denied", () => ({ verify_approval: () => null })],
  ["wrong digest", (p) => ({ verify_approval: (r) => ({ ...r, proposal_digest: "sha256:" + "0".repeat(64), approval_id: "owner", expires_at: EXPIRY }) })],
  ["expired", () => ({ verify_approval: (r) => ({ ...r, approval_id: "owner", expires_at: "2000-01-01" }) })],
  ["wrong action", () => ({ verify_approval: (r) => ({ ...r, action: "rollback", approval_id: "owner", expires_at: EXPIRY }) })],
]) test(`approval denial: ${name}`, () => fixture((root) => {
  const p = proposal(root); const before = snapshot(root);
  assert.throws(() => project.applyProjectUpdate(root, p, makeHost(p)), /approval/);
  assert.deepEqual(snapshot(root), before);
  assert.equal(fs.existsSync(file(root, ".mirai")), false);
}));

test("proposal tampering and cross-project reuse fail before local writes", () => fixture((root) => {
  const p = proposal(root);
  const forged = structuredClone(p); forged.after[OBJECTS] = Buffer.from("[]").toString("base64");
  assert.throws(() => project.applyProjectUpdate(root, forged, host(p)), /integrity/);
  const { digest, ...body } = forged; forged.digest = digestValue(body);
  assert.throws(() => project.applyProjectUpdate(root, forged, host(forged)), /recomputation/);
  fixture((other) => assert.throws(() => project.applyProjectUpdate(other, p, host(p)), /integrity/));
}));

test("CAS covers all Capsule files including notes and formatting-only edits", () => fixture((root) => {
  const p = proposal(root);
  fs.appendFileSync(file(root, "mirai/owner-notes.md"), "\nConcurrent owner edit\n");
  const current = snapshot(root);
  assert.throws(() => project.applyProjectUpdate(root, p, host(p)), /cas_conflict/);
  assert.deepEqual(snapshot(root), current);
  assert.equal(fs.existsSync(file(root, ".mirai")), false);
}));

test("only declared existing graph JSON can be changed", () => fixture((root) => {
  for (const ref of ["mirai/manifest.yaml", "mirai/manifest.lock.json", "mirai/policies/test.json", "graph.json", "../escape.json", "mirai/graph/new.json"]) {
    assert.throws(() => project.prepareProjectUpdate(root, { [ref]: "[]" }), /outside_graph_contract/);
  }
}));

test("missing/stale lock and snapshot budgets fail before staging or project writes", () => fixture((root) => {
  fs.appendFileSync(file(root, OBJECTS), " ");
  assert.throws(() => proposal(root), /invalid_capsule/);
  project.compileProjectCapsule(root);
  fs.writeFileSync(file(root, "mirai/too-large.bin"), Buffer.alloc(16 * 1024 * 1024));
  assert.throws(() => proposal(root), /snapshot_budget/);
  assert.equal(fs.existsSync(file(root, ".mirai")), false);
}));

test("dangling local-state link and linked graph input fail closed", { skip: process.platform === "win32" }, () => fixture((root) => {
  const p = proposal(root);
  fs.symlinkSync(path.join(root, "absent"), file(root, ".mirai"));
  assert.throws(() => project.applyProjectUpdate(root, p, host(p)), /symlink/);
  fs.unlinkSync(file(root, ".mirai"));
  fs.renameSync(file(root, OBJECTS), file(root, "copy.json"));
  fs.symlinkSync(file(root, "copy.json"), file(root, OBJECTS));
  assert.throws(() => proposal(root), /symlink|invalid_capsule/);
}));

test("concurrent writer is rejected and pending readers/compiler are blocked", () => fixture((root) => {
  const p = proposal(root);
  project.applyProjectUpdate(root, p, host(p, (point) => {
    if (point === "before_journal") assert.throws(() => project.applyProjectUpdate(root, p, host(p)), /lease_unavailable/);
    if (point === "after_pending") {
      assert.equal(project.validateProjectCapsule(root).valid, false);
      assert.throws(() => project.inspectProjectForAgent(root, "test"), /pending/);
      assert.throws(() => project.compileProjectCapsule(root), /pending/);
      assert.throws(() => project.applyProjectUpdate(root, p, host(p)), /pending/);
    }
  }));
}));

for (const point of ["before_journal", "after_journal", "after_pending", "before_receipt", "after_receipt",
  ...["mirai/START.md", OBJECTS, "mirai/manifest.lock.json"].flatMap((ref) => [`before_write:${ref}`, `after_write:${ref}`])]) {
  for (const action of ["apply", "rollback"]) test(`fault at ${point}, recover ${action}`, () => fixture((root) => {
    const p = proposal(root);
    interrupted(root, p, point);
    if (["before_journal", "after_journal"].includes(point)) {
      assert.deepEqual(snapshot(root), p.before);
      assert.equal(project.validateProjectCapsule(root).valid, true);
      assert.equal(project.applyProjectUpdate(root, p, host(p)).receipt.outcome, "committed");
      return;
    }
    assert.equal(project.validateProjectCapsule(root).valid, false);
    const result = project.recoverProjectUpdate(root, p.digest, action, host(p));
    const committed = action === "apply" || point === "after_receipt";
    assert.equal(result.receipt.outcome, committed ? "committed" : "rolled_back");
    assert.deepEqual(snapshot(root), committed ? p.after : p.before);
    assert.equal(project.validateProjectCapsule(root).valid, true);
    assert.equal(project.recoverProjectUpdate(root, p.digest, action, host(p)).changed, false);
  }));
}

test("receipt readback and facade are included in fault coverage", () => fixture((root) => {
  const manifest = JSON.parse(fs.readFileSync(file(root, "graph.json")));
  fs.writeFileSync(file(root, "graph.json"), JSON.stringify(manifest));
  const p = proposal(root);
  interrupted(root, p, "after_write:graph.json");
  project.recoverProjectUpdate(root, p.digest, "rollback", host(p));
  assert.deepEqual(snapshot(root), p.before);
}));

test("recovery preserves foreign changes and does not clear pending marker", () => fixture((root) => {
  const p = proposal(root);
  interrupted(root, p, `after_write:${OBJECTS}`);
  fs.writeFileSync(file(root, OBJECTS), "[{\"id\":\"foreign\"}]");
  const current = snapshot(root);
  for (const action of ["apply", "rollback"]) assert.throws(() => project.recoverProjectUpdate(root, p.digest, action, host(p)), /recovery_conflict/);
  assert.deepEqual(snapshot(root), current);
  assert(fs.existsSync(file(root, PENDING)));
}));

test("recovery requires fresh approval; corrupted journal and receipt are rejected", () => fixture((root) => {
  const p = proposal(root);
  interrupted(root, p, "after_pending");
  assert.throws(() => project.recoverProjectUpdate(root, p.digest, "apply", {}), /approval/);
  const ref = `.mirai/project-updates/${p.digest.slice(7)}.journal.json`;
  fs.appendFileSync(file(root, ref), "partial");
  assert.throws(() => project.recoverProjectUpdate(root, p.digest, "apply", host(p)), /JSON|Unexpected/);
  assert.deepEqual(snapshot(root), p.before);
}));

test("authority expiry during writes leaves recoverable incomplete transaction", () => fixture((root) => {
  const p = proposal(root); let expired = false;
  const authority = host(p, (point) => { if (point === `after_write:${OBJECTS}`) expired = true; });
  const verify = authority.verify_approval;
  authority.verify_approval = (r) => expired ? null : verify(r);
  assert.throws(() => project.applyProjectUpdate(root, p, authority), /approval_denied/);
  assert.equal(project.validateProjectCapsule(root).valid, false);
  project.recoverProjectUpdate(root, p.digest, "rollback", host(p));
  assert.deepEqual(snapshot(root), p.before);
}));

test("actual process death retains lease/journal and explicit recovery resumes", { skip: process.platform === "win32" }, () => fixture((root) => {
  const p = proposal(root);
  const code = `const p = ${JSON.stringify(p)}; const project = require(${JSON.stringify(require.resolve("../../dist/cjs/project"))});
    project.applyProjectUpdate(${JSON.stringify(root)}, p, { verify_approval: (r) => ({ ...r, approval_id: "synthetic.owner", expires_at: ${JSON.stringify(EXPIRY)} }),
    on_checkpoint: (s) => { if (s === "after_write:${OBJECTS}") process.kill(process.pid, "SIGKILL"); }});`;
  const result = spawnSync(process.execPath, ["-e", code]);
  assert.equal(result.signal, "SIGKILL");
  assert.equal(project.validateProjectCapsule(root).valid, false);
  assert.equal(project.recoverProjectUpdate(root, p.digest, "apply", host(p)).receipt.outcome, "committed");
  assert.equal(project.validateProjectCapsule(root).valid, true);
}));

test("Capsule continuity uses exact approved proposal, supports retries and no legacy root", () => fixture((root) => {
  const manifest = JSON.parse(fs.readFileSync(file(root, "graph.json")));
  const evidence = { task_digest: "sha256:" + "a".repeat(64), outcome: "Synthetic verified outcome", requirement_refs: ["requirement.example"],
    evidence_refs: ["evidence.example"], checks: [{ id: "check.example", verdict: "pass", evidence_ref: "evidence.example" }] };
  const before = snapshot(root);
  const p = continuity.prepareCapsuleContinuity(root, "task_complete", evidence);
  assert.deepEqual(snapshot(root), before);
  const stateRoot = file(root, ".mirai/continuity-host");
  const options = { capsuleProposal: p, capsuleHost: host(p), stateRoot };
  assert.equal(continuity.sync(root, manifest, "task_complete", evidence).status, "blocked");
  assert.equal(continuity.sync(root, manifest, "stage_complete", evidence, options).status, "blocked");
  const result = continuity.sync(root, manifest, "task_complete", evidence, options);
  assert.equal(result.status, "success", JSON.stringify(result));
  assert.equal(result.continuity.saved_refs.length, 2);
  assert.equal(project.validateProjectCapsule(root).valid, true);
  assert.equal(continuity.sync(root, manifest, "task_complete", evidence, options).changed, false);
  assert.equal(fs.existsSync(file(root, "graph")), false);
  assert.equal(continuity.verify(root, manifest, options).status, "success");
}));

test("facade disagreement and duplicate graph identities cannot be promoted", () => fixture((root) => {
  const duplicate = { id: "duplicate.identity", kind: "evidence" };
  assert.throws(() => project.prepareProjectUpdate(root, { [OBJECTS]: JSON.stringify([duplicate, duplicate]) }), /identity/);
  const facade = JSON.parse(fs.readFileSync(file(root, "graph.json")));
  facade.owner = "unapproved.owner";
  fs.writeFileSync(file(root, "graph.json"), JSON.stringify(facade));
  assert.throws(() => proposal(root), /facade_mismatch/);
}));

test("tampered receipt and mismatched pending journal fail closed", () => fixture((root) => {
  const p = proposal(root);
  interrupted(root, p, "after_receipt");
  fs.writeFileSync(file(root, PENDING), JSON.stringify({ proposal_digest: "sha256:" + "0".repeat(64) }));
  assert.throws(() => project.recoverProjectUpdate(root, p.digest, "apply", host(p)), /pending_mismatch/);
  fs.writeFileSync(file(root, PENDING), JSON.stringify({ proposal_digest: p.digest }));
  const ref = `.mirai/project-updates/${p.digest.slice(7)}.receipt.json`;
  const receipt = JSON.parse(fs.readFileSync(file(root, ref)));
  receipt.image_digest = "sha256:" + "0".repeat(64);
  fs.writeFileSync(file(root, ref), JSON.stringify(receipt));
  assert.throws(() => project.recoverProjectUpdate(root, p.digest, "apply", host(p)), /receipt_invalid/);
  assert(fs.existsSync(file(root, PENDING)));
}));

test("recovery crash itself can be resumed; committed transactions cannot be rolled back implicitly", () => fixture((root) => {
  const p = proposal(root);
  interrupted(root, p, `after_write:${OBJECTS}`);
  assert.throws(() => project.recoverProjectUpdate(root, p.digest, "rollback", host(p, (step) => {
    if (step === `after_write:${OBJECTS}`) throw new Error("rollback_crash");
  })), /rollback_crash/);
  assert.equal(project.recoverProjectUpdate(root, p.digest, "rollback", host(p)).receipt.outcome, "rolled_back");
  assert.throws(() => project.applyProjectUpdate(root, p, host(p)), /previously_rolled_back/);
  assert.deepEqual(snapshot(root), p.before);
}));

test("foreign new files and source edits block recovery without deleting them", () => fixture((root) => {
  const p = proposal(root);
  interrupted(root, p, "after_pending");
  fs.writeFileSync(file(root, "mirai/new-owner-note.md"), "Do not remove me");
  const current = snapshot(root);
  assert.throws(() => project.recoverProjectUpdate(root, p.digest, "rollback", host(p)), /recovery_conflict/);
  assert.deepEqual(snapshot(root), current);
}));

test("concurrent edit immediately before write is detected, not overwritten", () => fixture((root) => {
  const p = proposal(root);
  assert.throws(() => project.applyProjectUpdate(root, p, host(p, (step) => {
    if (step === `before_write:${OBJECTS}`) fs.writeFileSync(file(root, OBJECTS), "[{\"id\":\"other\"}]");
  })), /cas_conflict/);
  assert.equal(fs.readFileSync(file(root, OBJECTS), "utf8"), "[{\"id\":\"other\"}]");
}));

test("update preserves restricted file permissions", { skip: process.platform === "win32" }, () => fixture((root) => {
  fs.chmodSync(file(root, OBJECTS), 0o600);
  const p = proposal(root);
  project.applyProjectUpdate(root, p, host(p));
  assert.equal(fs.statSync(file(root, OBJECTS)).mode & 0o777, 0o600);
}));

test("orphaned reclaim guard and live lease are not stolen", () => fixture((root) => {
  const p = proposal(root);
  interrupted(root, p, "after_pending");
  const guard = ".mirai/project-update.reclaim.json";
  fs.writeFileSync(file(root, guard), JSON.stringify({ token: "uncertain", pid: 1 }));
  assert.throws(() => project.recoverProjectUpdate(root, p.digest, "apply", host(p)), /reclaim_in_progress/);
  fs.unlinkSync(file(root, guard));
  const lease = ".mirai/project-update.lease.json";
  fs.writeFileSync(file(root, lease), JSON.stringify({ token: "active", pid: process.pid }));
  assert.throws(() => project.recoverProjectUpdate(root, p.digest, "apply", host(p)), /lease_alive/);
  assert.equal(JSON.parse(fs.readFileSync(file(root, lease))).token, "active");
}));

function enabled(root) {
  const facade = JSON.parse(fs.readFileSync(file(root, "graph.json")));
  facade.extensions = { "mirai.project_technology": technology.extensionContract() };
  fs.writeFileSync(file(root, "graph.json"), JSON.stringify(facade, null, 2) + "\n");
  return { facade, stateRoot: file(root, ".mirai/continuity-host") };
}
function taskEvidence(task, extra = {}) {
  return { task_digest: continuity.digest(task), outcome: "Verified synthetic result", requirement_refs: ["requirement.synthetic"],
    evidence_refs: ["evidence.synthetic"], checks: [{ id: "check.synthetic", verdict: "pass", evidence_ref: "evidence.synthetic" }], ...extra };
}
function save(root, config, boundary, evidence) {
  const p = continuity.prepareCapsuleContinuity(root, boundary, evidence);
  const options = { ...config, apply: true, capsuleProposal: p, capsuleHost: host(p), boundary, continuityEvidence: evidence };
  const result = technology.execute("sync", root, options);
  assert.equal(result.status, "success", JSON.stringify(result));
  assert.equal(result.continuity.policy, "task_boundary");
  assert.equal(result.continuity.freshness, "current");
  return { p, options, result };
}

for (const point of ["after_pending", `after_write:${OBJECTS}`]) test(`F1: task start and CLI block pending Capsule at ${point}`, () => fixture((root) => {
  const config = enabled(root);
  save(root, config, "task_complete", taskEvidence("prior"));
  const evidence = taskEvidence("next");
  const p = continuity.prepareCapsuleContinuity(root, "task_complete", evidence);
  interrupted(root, p, point);
  const before = snapshot(root);
  const result = technology.execute("sync", root, { ...config, apply: true, boundary: "task_start" });
  assert.equal(result.status, "blocked");
  assert.notEqual(result.continuity.freshness, "current");
  assert.equal(result.changed, false);
  const cli = spawnSync(process.execPath, [path.resolve(__dirname, "../../packages/cli/mirai-graph.js"), "technology", "sync", root, "--apply", "--boundary", "task_start"],
    { cwd: root, encoding: "utf8", env: { ...process.env, MIRAI_GRAPH_STATE_ROOT: config.stateRoot } });
  assert.equal(cli.status, 2, cli.stderr);
  assert.equal(JSON.parse(cli.stdout).status, "blocked");
  assert.deepEqual(snapshot(root), before);
}));

test("F2: approved generic changes cannot claim unsaved continuity records", () => fixture((root) => {
  const config = enabled(root); const evidence = taskEvidence("real");
  const expected = continuity.prepareCapsuleContinuity(root, "task_complete", evidence);
  const p = project.prepareProjectUpdate(root, { [OBJECTS]: JSON.stringify([{ id: "unrelated.object", kind: "evidence" }]) }, expected.context);
  const before = snapshot(root);
  const result = technology.execute("sync", root, { ...config, apply: true, boundary: "task_complete", continuityEvidence: evidence, capsuleProposal: p, capsuleHost: host(p) });
  assert.equal(result.status, "blocked");
  assert(result.blockers.includes("continuity_capsule_semantic_delta_mismatch"));
  assert.deepEqual(snapshot(root), before);
  assert.equal(fs.existsSync(file(root, ".mirai")), false);
}));

test("F2: verification checks saved references and exact saved object digests", () => fixture((root) => {
  const config = enabled(root); const evidence = taskEvidence("saved");
  const { result } = save(root, config, "task_complete", evidence);
  const state = continuity.stateRoot(root, config.facade, config);
  const pointer = JSON.parse(fs.readFileSync(path.join(state, "latest-receipt.json")));
  const receiptFile = path.join(state, pointer.receipt_ref);
  const receipt = JSON.parse(fs.readFileSync(receiptFile));
  receipt.saved_refs.push("never.saved");
  receipt.saved_object_digests["never.saved"] = "sha256:" + "0".repeat(64);
  const { receipt_digest, ...body } = receipt;
  receipt.receipt_digest = continuity.digest(body);
  fs.writeFileSync(receiptFile, continuity.canonicalBytes(receipt));
  fs.writeFileSync(path.join(state, "latest-receipt.json"), continuity.canonicalBytes({ ...pointer, receipt_digest: receipt.receipt_digest }));
  assert.equal(continuity.verify(root, config.facade, config).status, "blocked");
  assert.equal(continuity.status(root, config.facade, config).freshness, "stale");
  assert(result.continuity.saved_refs.length > 0);
}));

test("continuity pointer must match its receipt digest", () => fixture((root) => {
  const config = enabled(root);
  save(root, config, "task_complete", taskEvidence("pointer"));
  const pointerFile = path.join(continuity.stateRoot(root, config.facade, config), "latest-receipt.json");
  const pointer = JSON.parse(fs.readFileSync(pointerFile));
  pointer.receipt_digest = "sha256:" + "0".repeat(64);
  fs.writeFileSync(pointerFile, JSON.stringify(pointer));
  assert.equal(continuity.verify(root, config.facade, config).status, "blocked");
  assert.equal(continuity.status(root, config.facade, config).freshness, "missing");
}));

test("F3: approved stage-to-task progression and two-case lesson promotion preserve identity", () => fixture((root) => {
  const config = enabled(root);
  const extra = { case_signature: "case.shared", method_candidate: "Use the verified method." };
  const first = taskEvidence("first", extra);
  save(root, config, "stage_complete", first);
  save(root, config, "task_complete", first);
  const { p, options } = save(root, config, "task_complete", taskEvidence("second", extra));
  assert.equal(technology.execute("sync", root, options).changed, false);
  const objects = JSON.parse(fs.readFileSync(file(root, OBJECTS)));
  const lessons = objects.filter((item) => item.kind === "lesson");
  assert.equal(lessons.length, 1);
  assert.equal(lessons[0].readiness, "accepted");
  assert.equal(lessons[0].supporting_case_ids.length, 2);
  assert.equal(new Set(objects.map((item) => item.id)).size, objects.length);
  assert.equal(project.applyProjectUpdate(root, p, host(p)).changed, false);
}));

test("F3: foreign continuity-looking identity is not silently overwritten", () => fixture((root) => {
  const config = enabled(root); const evidence = taskEvidence("foreign");
  const p = continuity.prepareCapsuleContinuity(root, "task_complete", evidence);
  const id = p.context.saved_refs[0];
  fs.writeFileSync(file(root, OBJECTS), JSON.stringify([{ id, kind: "evidence", summary: "Foreign record without continuity provenance" }]));
  project.compileProjectCapsule(root);
  assert.throws(() => continuity.prepareCapsuleContinuity(root, "task_complete", evidence), /identity_conflict/);
}));

test("single-object entrypoints can propose an explicitly approved collection", () => fixture((root) => {
  const config = enabled(root);
  fs.writeFileSync(file(root, OBJECTS), JSON.stringify({ id: "owner.object", kind: "goal" }));
  project.compileProjectCapsule(root);
  save(root, config, "task_complete", taskEvidence("single"));
  const objects = JSON.parse(fs.readFileSync(file(root, OBJECTS)));
  assert.equal(objects[0].id, "owner.object");
  assert.equal(objects.length, 3);
}));

test("F4: public sync reports partial writes and exact recovery correlation", () => fixture((root) => {
  const config = enabled(root); const evidence = taskEvidence("partial");
  const p = continuity.prepareCapsuleContinuity(root, "task_complete", evidence);
  const result = technology.execute("sync", root, { ...config, apply: true, boundary: "task_complete", continuityEvidence: evidence, capsuleProposal: p,
    capsuleHost: host(p, (point) => { if (point === `after_write:${OBJECTS}`) throw new Error("synthetic_crash"); }) });
  assert.equal(result.status, "blocked");
  assert.equal(result.changed, true);
  assert.equal(result.transaction.status, "pending");
  assert.equal(result.transaction.proposal_digest, p.digest);
  assert.equal(result.next_action, "inspect_pending_transaction_before_retry");
  project.recoverProjectUpdate(root, p.digest, "apply", host(p));
  const retried = technology.execute("sync", root, { ...config, apply: true, boundary: "task_complete", continuityEvidence: evidence, capsuleProposal: p, capsuleHost: host(p) });
  assert.equal(retried.status, "success");
}));

for (const failure of ["state_root", "receipt_pointer"]) test(`F4: committed transaction survives failed ${failure} projection and retries`, () => fixture((root) => {
  const config = enabled(root); const evidence = taskEvidence(failure);
  const p = continuity.prepareCapsuleContinuity(root, "task_complete", evidence);
  const obstruct = failure === "state_root" ? config.stateRoot : path.join(continuity.stateRoot(root, config.facade, config), "latest-receipt.json");
  fs.mkdirSync(path.dirname(obstruct), { recursive: true });
  if (failure === "state_root") fs.writeFileSync(obstruct, "obstruction"); else fs.mkdirSync(obstruct);
  const options = { ...config, apply: true, boundary: "task_complete", continuityEvidence: evidence, capsuleProposal: p, capsuleHost: host(p) };
  const result = technology.execute("sync", root, options);
  assert.equal(result.status, "blocked");
  assert.equal(result.changed, true);
  assert.equal(result.transaction.status, "committed");
  assert.equal(result.next_action, "retry_receipt_projection_with_same_proposal");
  assert.equal(fs.existsSync(file(root, PENDING)), false);
  const canonical = snapshot(root);
  fs.rmSync(obstruct, { recursive: true });
  const retried = technology.execute("sync", root, options);
  assert.equal(retried.status, "success", JSON.stringify(retried));
  assert.equal(retried.continuity.freshness, "current");
  assert.deepEqual(snapshot(root), canonical);
  assert.equal(continuity.verify(root, config.facade, config).status, "success");
}));
