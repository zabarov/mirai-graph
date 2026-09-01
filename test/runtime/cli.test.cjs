const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const cli = path.join(root, "packages/cli/mirai.js");
const fixture = path.join(root, "examples/mirai-governed-runtime-minimal");

function command(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8", ...options });
}

function findFile(directory, name) {
  const queue = [directory];
  while (queue.length) {
    const current = queue.shift();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) queue.push(target);
      else if (entry.name === name) return target;
    }
  }
  throw new Error(`${name} not found`);
}

test("primary CLI exposes Mirai 2 help and version while preserving legacy routing", () => {
  const help = command(["--help"]);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stderr, /Mirai 2 CLI \(alpha\.3\)/);
  const version = command(["--version"]);
  assert.equal(version.status, 0, version.stderr);
  assert.equal(version.stdout.trim(), "2.0.0-alpha.3");
  const legacy = command(["validate", path.join(root, "examples/minimal-graph")]);
  assert.equal(legacy.status, 0, legacy.stderr);
  assert.equal(JSON.parse(legacy.stdout).valid, true);
});

test("CLI run, inspect, replay and sanitized evidence form a closed workflow", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-cli-runtime-"));
  const home = path.join(temp, "home");
  const output = path.join(temp, "evidence");
  const program = path.join(fixture, "results/program.mirai.json");
  const input = path.join(fixture, "input.json");
  const sandbox = path.join(fixture, "sandbox");
  const run = command(["run", program, "--input", input, "--sandbox", sandbox, "--home", home, "--run-id", "run.cli-test"]);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).run.status, "completed");

  const inspect = command(["inspect", "run.cli-test", "--home", home]);
  assert.equal(inspect.status, 0, inspect.stderr);
  assert(!inspect.stdout.includes("Synthetic repository note"));
  assert(!inspect.stdout.includes(sandbox));

  const episode = findFile(home, "episode.json");
  const replay = command(["replay", episode, "--program", program]);
  assert.equal(replay.status, 0, replay.stderr);
  assert.equal(JSON.parse(replay.stdout).status, "match");

  const evidence = command(["evidence", "export", "run.cli-test", "--out", output, "--home", home]);
  assert.equal(evidence.status, 0, evidence.stderr);
  const exported = fs.readFileSync(path.join(output, "mirai-evidence.json"), "utf8");
  assert(!exported.includes("Synthetic repository note"));
  assert(!exported.includes("opaque_token"));
  assert(!exported.includes(sandbox));
});

test("CLI refuses YAML as runtime input", () => {
  const result = command([
    "run", path.join(fixture, "program.mirai.yaml"),
    "--input", path.join(fixture, "input.json"),
    "--sandbox", path.join(fixture, "sandbox")
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /compiled \.mirai\.json IR only/);
});
