#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats");

const root = path.resolve(__dirname, "../..");
const pilotDirectories = [
  "pilots/mirai-2-beta-federation",
  "pilots/mirai-2-beta-larena",
  "pilots/mirai-2-beta-ai-employee"
];

function readJson(filename) {
  return JSON.parse(fs.readFileSync(filename, "utf8"));
}

function schema(name) {
  return readJson(path.join(root, "schemas", name));
}

function validator(name) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schema(name));
}

const validatePilotShape = validator("mirai-beta-pilot-result.schema.json");
const validatePureEpisode = validator("mirai-pure-episode.schema.json");
const validateGovernedEpisode = validator("mirai-governed-episode.schema.json");
const validateSanitizedEvidence = validator("mirai-sanitized-evidence.schema.json");
const validateIndependentResult = validator("mirai-independent-artifact-result.schema.json");

function isExternalRef(ref) {
  return /^[a-z][a-z0-9+.-]*:/i.test(ref);
}

function resolveRef(ref, errors, label) {
  if (isExternalRef(ref)) return null;
  const target = path.resolve(root, ref);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    errors.push(`${label}:reference_outside_repository:${ref}`);
    return null;
  }
  if (!fs.existsSync(target)) errors.push(`${label}:reference_missing:${ref}`);
  return target;
}

function formatAjvErrors(validate) {
  return (validate.errors || []).map((error) => `${error.instancePath || "/"}:${error.message}`);
}

function semanticErrors(document, pilotDirectory) {
  const errors = [];
  const expectedConditions = ["plain_instructions", "mirai_graph_1_4", "mirai_2_0"];
  const conditionIds = document.conditions.map((item) => item.id);
  if (new Set(conditionIds).size !== conditionIds.length) errors.push("conditions:duplicate_id");
  for (const id of expectedConditions) if (!conditionIds.includes(id)) errors.push(`conditions:missing:${id}`);
  for (const condition of document.conditions) {
    if (condition.accepted_count !== null && condition.accepted_count > condition.run_count) {
      errors.push(`conditions:${condition.id}:accepted_count_exceeds_run_count`);
    }
    if (["completed", "historical_evidence"].includes(condition.status) && condition.evidence_refs.length === 0) {
      errors.push(`conditions:${condition.id}:evidence_required`);
    }
    for (const ref of condition.evidence_refs) resolveRef(ref, errors, `conditions:${condition.id}`);
  }
  if (document.metrics.unauthorized_effects !== 0) errors.push("metrics:unauthorized_effects_must_be_zero");
  if (document.status === "engineering_evidence_complete") {
    const current = document.conditions.find((item) => item.id === "mirai_2_0");
    if (!current || current.status !== "completed") errors.push("status:mirai_2_condition_not_completed");
    if (document.metrics.false_completion_claims !== 0) errors.push("status:false_completion_claim_present");
  }

  const protocolPath = resolveRef(document.protocol_ref, errors, "protocol_ref");
  const programPath = resolveRef(document.mirai_2.program_ref, errors, "mirai_2.program_ref");
  const irPath = resolveRef(document.mirai_2.ir_ref, errors, "mirai_2.ir_ref");
  const episodePath = resolveRef(document.mirai_2.episode_ref, errors, "mirai_2.episode_ref");
  const evidencePath = resolveRef(document.mirai_2.evidence_ref, errors, "mirai_2.evidence_ref");
  const replayPath = resolveRef(document.mirai_2.replay_ref, errors, "mirai_2.replay_ref");
  const independentPath = resolveRef(document.mirai_2.independent_conformance_ref, errors, "mirai_2.independent_conformance_ref");
  for (const ref of document.human_review.evidence_refs) resolveRef(ref, errors, "human_review");

  if (protocolPath && !protocolPath.endsWith("mirai-2-beta-pilot-protocol.md")) errors.push("protocol_ref:unexpected_protocol");
  if (programPath && irPath) {
    try {
      const { compileProgramFile } = require("../../dist/cjs/program");
      const source = compileProgramFile(programPath).program;
      const ir = compileProgramFile(irPath).program;
      if (source.digest !== ir.digest) errors.push("mirai_2:source_ir_digest_mismatch");
    } catch (error) {
      errors.push(`mirai_2:program_invalid:${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (episodePath && irPath) {
    const episode = readJson(episodePath);
    const ir = readJson(irPath);
    const episodeValidator = Array.isArray(episode.effect_stubs) ? validateGovernedEpisode : validatePureEpisode;
    if (!episodeValidator(episode)) errors.push(...formatAjvErrors(episodeValidator).map((item) => `episode${item}`));
    if (episode.program_digest !== ir.digest) errors.push("episode:program_digest_mismatch");
    if (document.mirai_2.execution_mode === "pure_no_effects" && episode.effects_executed !== false) errors.push("episode:pure_effect_boundary_broken");
    if (document.mirai_2.execution_mode === "dry_run_no_send" && episode.effects_executed !== false) errors.push("episode:no_send_effect_boundary_broken");
    if (document.mirai_2.execution_mode === "governed_sandbox" && episode.effects_executed !== true) errors.push("episode:governed_effect_evidence_missing");
  }
  if (evidencePath && document.mirai_2.execution_mode === "governed_sandbox") {
    const evidence = readJson(evidencePath);
    if (!validateSanitizedEvidence(evidence)) errors.push(...formatAjvErrors(validateSanitizedEvidence).map((item) => `evidence${item}`));
  }
  if (replayPath) {
    const replay = readJson(replayPath);
    if (replay.status !== "match") errors.push("replay:status_not_match");
    const replayEffects = replay.effects_executed ?? replay.replay_episode?.effects_executed;
    if (replayEffects !== false) errors.push("replay:effects_were_executed");
  }
  if (independentPath) {
    const independent = readJson(independentPath);
    if (!validateIndependentResult(independent)) {
      errors.push(...formatAjvErrors(validateIndependentResult).map((item) => `independent${item}`));
    }
    if (independent.status !== "passed" || independent.errors.length !== 0) errors.push("independent:status_not_passed");
    const expectedSource = document.mirai_2.execution_mode === "governed_sandbox"
      ? document.mirai_2.evidence_ref
      : document.mirai_2.episode_ref;
    if (independent.source_ref !== expectedSource) errors.push("independent:source_ref_mismatch");
  }

  const publicFiles = [document.protocol_ref, document.mirai_2.program_ref, document.mirai_2.ir_ref,
    document.mirai_2.episode_ref, document.mirai_2.evidence_ref, document.mirai_2.replay_ref,
    document.mirai_2.independent_conformance_ref]
    .filter((ref) => !isExternalRef(ref));
  for (const ref of publicFiles) {
    const filename = path.resolve(root, ref);
    if (!fs.existsSync(filename) || fs.statSync(filename).isDirectory()) continue;
    const body = fs.readFileSync(filename, "utf8");
    if (/\/Users\/rim\/Documents\/GitHub\/(?:ai-codex|larena|bx-simai|science)/.test(body)) errors.push(`public_safety:private_path:${ref}`);
    if (/(?:ghp_[A-Za-z0-9]+|BEGIN PRIVATE KEY|xoxb-|raw \.env)/.test(body)) errors.push(`public_safety:secret_pattern:${ref}`);
  }
  if (!path.resolve(root, pilotDirectory).startsWith(path.join(root, "pilots") + path.sep)) errors.push("pilot:directory_boundary_invalid");
  return errors;
}

function validatePilot(pilotDirectory) {
  const filename = path.join(root, pilotDirectory, "results", "pilot-result.json");
  if (!fs.existsSync(filename)) return { pilot: pilotDirectory, valid: false, errors: ["pilot_result_missing"] };
  const document = readJson(filename);
  const errors = [];
  if (!validatePilotShape(document)) errors.push(...formatAjvErrors(validatePilotShape));
  if (errors.length === 0) errors.push(...semanticErrors(document, pilotDirectory));
  return { pilot: document.pilot_id || pilotDirectory, valid: errors.length === 0, errors };
}

function selfTest() {
  const filename = path.join(root, pilotDirectories[0], "results", "pilot-result.json");
  const document = structuredClone(readJson(filename));
  document.metrics.unauthorized_effects = 1;
  const errors = semanticErrors(document, pilotDirectories[0]);
  if (!errors.includes("metrics:unauthorized_effects_must_be_zero")) throw new Error("negative_fixture_was_not_rejected");
  process.stdout.write(`${JSON.stringify({ valid: true, negative_case: "unauthorized_effect_rejected" }, null, 2)}\n`);
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  const results = pilotDirectories.map(validatePilot);
  const valid = results.every((item) => item.valid);
  process.stdout.write(`${JSON.stringify({ valid, results }, null, 2)}\n`);
  process.exitCode = valid ? 0 : 1;
}
