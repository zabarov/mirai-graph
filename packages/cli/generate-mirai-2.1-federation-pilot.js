#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020").default;
const { resolveActivationPlan, runActivationPlan, simulateActivationPlan } = require("../../dist/cjs/activation");

const root = path.resolve(__dirname, "../..");
const pilot = path.join(root, "pilots/mirai-2.1-beta-federation");
const resultsDir = path.join(pilot, "results");

function readJson(filename) {
  return JSON.parse(fs.readFileSync(filename, "utf8"));
}

function stableRunResult(result) {
  return {
    ...result,
    path_results: result.path_results.map(({ run_id: _runId, ...item }) => item)
  };
}

function comparison(plan, simulation, run, baselineEpisode) {
  return {
    contract_version: "1.0.0",
    pilot_id: "pilot.mirai-2.1.federation.graph-native",
    status: "engineering_evidence_complete",
    baseline: {
      id: "mirai_2_explicit_program",
      status: "completed",
      artifact_refs: [
        "pilots/mirai-2-beta-federation/programs/program.mirai.yaml",
        "pilots/mirai-2-beta-federation/results/episode.json"
      ],
      trace_digest: baselineEpisode.trace_digest,
      stage_ids: ["route", "technology_packet", "skill_sync", "reverse_audit", "kaizen"]
    },
    graph_resolved: {
      id: "mirai_2_1_graph_resolved",
      status: "completed",
      artifact_refs: [
        "pilots/mirai-2.1-beta-federation/results/activation-plan.json",
        "pilots/mirai-2.1-beta-federation/results/activation-run-result.json",
        "conformance/results/python-mirai-2.1-activation-plan-result.json",
        "conformance/results/python-mirai-2.1-activation-run-result.json"
      ],
      trace_digest: run.aggregate_trace_digest,
      stage_ids: plan.activated_paths.map((item) => item.component_instance)
    },
    metrics: {
      technology_adherence_percent: run.status === "completed" && run.path_results.every((item) => item.status === "completed") ? 100 : 0,
      unauthorized_effects: 0,
      false_completion_claims: 0,
      deterministic_trace_equality: true,
      activated_path_count: plan.activated_paths.length,
      parallel_frontier_width: Math.max(0, ...simulation.frontiers.map((item) => item.length)),
      model_calls: 0,
      tokens: 0,
      cost_usd: 0
    },
    safety: {
      production_effects: false,
      network_effects: false,
      canonical_graph_write: false,
      automatic_learning_update: false
    },
    limitations: [
      "This is one deterministic public-safe fixture, not a randomized comparative study.",
      "The Mirai 2.0 and Mirai 2.1 traces represent different orchestration contracts and their digests are not expected to match.",
      "No LLM, production Federation state or external effect is used in this engineering pilot.",
      "Independent conformance and blinded human review remain required before scientific effectiveness claims."
    ],
    claim_boundary: "The fixture shows that Mirai 2.1 can resolve a governed Federation process into digest-bound deterministic frontiers and execute them through the Mirai 2.0 runtime without effects or canonical learning."
  };
}

async function generate() {
  const snapshot = readJson(path.join(pilot, "graph-snapshot.json"));
  const signal = readJson(path.join(pilot, "signal.json"));
  const baselineEpisode = readJson(path.join(root, "pilots/mirai-2-beta-federation/results/episode.json"));
  const plan = resolveActivationPlan(snapshot, signal);
  const simulation = simulateActivationPlan(plan);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-2.1-federation-"));
  const runA = stableRunResult(await runActivationPlan(plan, { base_dir: root, sandbox: path.join(temporary, "sandbox-a"), home: path.join(temporary, "home-a") }));
  const runB = stableRunResult(await runActivationPlan(plan, { base_dir: root, sandbox: path.join(temporary, "sandbox-b"), home: path.join(temporary, "home-b") }));
  assert.equal(runA.aggregate_trace_digest, runB.aggregate_trace_digest, "activation trace must be deterministic");
  assert.equal(runA.status, "completed");
  assert.equal(runA.effects_executed, false);
  assert.deepEqual(simulation.frontiers, [
    ["path.stage.route.operation.process"],
    ["path.stage.docs-owner.operation.process", "path.stage.graph-owner.operation.process"],
    ["path.stage.quality.operation.process"],
    ["path.stage.kaizen.operation.process"]
  ]);
  const pilotResult = comparison(plan, simulation, runA, baselineEpisode);
  for (const filename of ["python-mirai-2.1-activation-plan-result.json", "python-mirai-2.1-activation-run-result.json"]) {
    const independent = readJson(path.join(root, "conformance/results", filename));
    assert.equal(independent.status, "passed", `${filename} must pass independently`);
    assert.deepEqual(independent.errors, [], `${filename} must have no errors`);
  }
  const schema = readJson(path.join(root, "schemas/mirai-2.1-federation-pilot-result.schema.json"));
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  assert.equal(validate(pilotResult), true, JSON.stringify(validate.errors));
  return { plan, simulation, run: runA, pilotResult };
}

async function main() {
  const artifacts = await generate();
  const documents = {
    "activation-plan.json": artifacts.plan,
    "activation-simulation.json": artifacts.simulation,
    "activation-run-result.json": artifacts.run,
    "pilot-result.json": artifacts.pilotResult
  };
  if (process.argv.includes("--write")) {
    fs.mkdirSync(resultsDir, { recursive: true });
    for (const [name, document] of Object.entries(documents)) fs.writeFileSync(path.join(resultsDir, name), `${JSON.stringify(document, null, 2)}\n`);
  } else {
    for (const [name, expected] of Object.entries(documents)) {
      const filename = path.join(resultsDir, name);
      assert.equal(fs.existsSync(filename), true, `missing committed pilot artifact: ${name}`);
      assert.deepEqual(readJson(filename), expected, `stale committed pilot artifact: ${name}`);
    }
  }
  process.stdout.write(`${JSON.stringify({ valid: true, status: artifacts.pilotResult.status, plan_digest: artifacts.plan.digest, trace_digest: artifacts.run.aggregate_trace_digest, write: process.argv.includes("--write") }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
