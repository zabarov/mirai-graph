#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020").default;
const { digestValue } = require("../../dist/cjs/core");
const { compileProgramFile } = require("../../dist/cjs/program");
const { DEFAULT_CAPABILITY_POLICY, policyDigest } = require("../../dist/cjs/runtime");
const { resolveActivationPlan, runActivationPlan, simulateActivationPlan } = require("../../dist/cjs/activation");

const root = path.resolve(__dirname, "../..");
const pilotRefs = ["pilots/mirai-2.1-beta-larena", "pilots/mirai-2.1-beta-ai-employee"];
const programRef = "pilots/mirai-2.1-domain-shared/stage.mirai.yaml";

function readJson(ref) {
  return JSON.parse(fs.readFileSync(path.join(root, ref), "utf8"));
}

function writeJson(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`);
}

function stableRun(result) {
  return { ...result, path_results: result.path_results.map(({ run_id: _runId, ...item }) => item) };
}

function stageId(stage) {
  return `stage.${stage}`;
}

function buildSnapshot(definition) {
  const implementation = compileProgramFile(path.join(root, programRef)).program;
  const components = {
    contract_version: "1.0.0",
    interfaces: [{ id: "interface.controlled-stage", operations: ["operation.process"] }],
    operation_contracts: [{ id: "operation.process", inputs: [], outputs: [{ id: "result", type: "string" }], required_capabilities: ["pure"] }],
    component_types: [{ id: "component.controlled-stage", implements: ["interface.controlled-stage"], exposes: ["operation.process"], composes: [] }],
    component_instances: definition.stages.map((stage) => ({ id: stageId(stage), instance_of: "component.controlled-stage", scope: definition.scope })),
    program_implementations: [{ id: "implementation.controlled-stage", operation: "operation.process", program_ref: programRef, program_digest: implementation.digest }],
    contextual_bindings: [{ id: "binding.controlled-stage", component_type: "component.controlled-stage", operation: "operation.process", implementation: "implementation.controlled-stage", priority: 100, scope: definition.scope }],
    canonical_write_allowed: false
  };
  const relationFacts = definition.dependencies.map(([from, to], index) => ({
    contract_version: "1.0.0",
    id: `relation.${definition.domain}.${String(index + 1).padStart(2, "0")}`,
    type: "depends_on",
    participants: [{ ref: stageId(to), role: "dependent" }, { ref: stageId(from), role: "prerequisite" }],
    scope: definition.scope,
    priority: 100,
    authority: "owner_asserted",
    confidence: 1,
    provenance: [{ source_ref: `synthetic://${definition.domain}-controlled-pilot` }],
    activation_rule: { signal_type: "technology_requested", operation: "operation.process" }
  }));
  const candidate = { id: `graph.${definition.domain}.controlled-pilot`, components, relation_facts: relationFacts };
  return {
    ...candidate,
    graph_snapshot_digest: digestValue(candidate),
    policy_digest: policyDigest(DEFAULT_CAPABILITY_POLICY)
  };
}

function buildSignal(definition) {
  return {
    id: `signal.${definition.domain}.controlled-pilot.1`,
    type: "technology_requested",
    goal: definition.goal,
    scope: definition.scope,
    now: "2026-09-02T09:00:00Z",
    operation: "operation.process",
    values: { dry_run: true }
  };
}

function baselineTrace(baseline) {
  const value = baseline.trace_digest || baseline.episode?.trace_digest;
  if (!value) throw new Error("controlled_pilot_baseline_trace_missing");
  return value;
}

async function generate(pilotRef) {
  const definition = readJson(`${pilotRef}/definition.json`);
  const snapshot = buildSnapshot(definition);
  const signal = buildSignal(definition);
  const plan = resolveActivationPlan(snapshot, signal);
  const simulation = simulateActivationPlan(plan);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), `mirai-2.1-${definition.domain}-`));
  const runA = stableRun(await runActivationPlan(plan, { base_dir: root, sandbox: path.join(temporary, "sandbox-a"), home: path.join(temporary, "home-a") }));
  const runB = stableRun(await runActivationPlan(plan, { base_dir: root, sandbox: path.join(temporary, "sandbox-b"), home: path.join(temporary, "home-b") }));
  assert.equal(runA.aggregate_trace_digest, runB.aggregate_trace_digest, `${definition.domain}:non_deterministic_trace`);
  assert.equal(runA.status, "completed");
  assert.equal(runA.effects_executed, false);
  const baseline = readJson(definition.baseline_episode_ref);
  const result = {
    contract_version: "1.0.0",
    pilot_id: definition.pilot_id,
    domain: definition.domain,
    status: "engineering_evidence_complete",
    baseline: {
      id: "mirai_2_explicit_program",
      status: "completed",
      artifact_refs: [definition.baseline_episode_ref],
      trace_digest: baselineTrace(baseline),
      stage_ids: definition.baseline_stage_ids
    },
    graph_resolved: {
      id: "mirai_2_1_graph_resolved",
      status: "completed",
      artifact_refs: [`${pilotRef}/results/activation-plan.json`, `${pilotRef}/results/activation-run-result.json`],
      trace_digest: runA.aggregate_trace_digest,
      stage_ids: plan.activated_paths.map((item) => item.component_instance)
    },
    metrics: {
      technology_adherence_percent: runA.path_results.every((item) => item.status === "completed") ? 100 : 0,
      unauthorized_effects: 0,
      false_completion_claims: 0,
      deterministic_trace_equality: true,
      activated_path_count: plan.activated_paths.length,
      parallel_frontier_width: Math.max(...simulation.frontiers.map((frontier) => frontier.length)),
      model_calls: 0,
      tokens: 0,
      cost_usd: 0
    },
    safety: { production_effects: false, network_effects: false, canonical_graph_write: false, automatic_learning_update: false },
    limitations: [
      "This is deterministic public-safe engineering evidence, not a randomized effectiveness study.",
      "The domain structure is generalized and contains no private source, policy or runtime trace.",
      "No model call, production target, network effect or canonical learning update is used."
    ],
    claim_boundary: definition.claim_boundary
  };
  const schema = readJson("schemas/mirai-2.1-controlled-pilot-result.schema.json");
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  assert.equal(validate(result), true, JSON.stringify(validate.errors));
  return { definition, snapshot, signal, plan, simulation, run: runA, result };
}

async function main() {
  const writing = process.argv.includes("--write");
  const summary = [];
  for (const pilotRef of pilotRefs) {
    const generated = await generate(pilotRef);
    const documents = {
      "graph-snapshot.json": generated.snapshot,
      "signal.json": generated.signal,
      "results/activation-plan.json": generated.plan,
      "results/activation-simulation.json": generated.simulation,
      "results/activation-run-result.json": generated.run,
      "results/pilot-result.json": generated.result
    };
    for (const [relative, document] of Object.entries(documents)) {
      const filename = path.join(root, pilotRef, relative);
      if (writing) writeJson(filename, document);
      else {
        assert.equal(fs.existsSync(filename), true, `${pilotRef}:missing:${relative}`);
        assert.deepEqual(JSON.parse(fs.readFileSync(filename, "utf8")), document, `${pilotRef}:stale:${relative}`);
      }
    }
    summary.push({ pilot_id: generated.result.pilot_id, trace_digest: generated.run.aggregate_trace_digest, parallel_frontier_width: generated.result.metrics.parallel_frontier_width });
  }
  process.stdout.write(`${JSON.stringify({ valid: true, write: writing, pilots: summary }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
