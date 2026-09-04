#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats").default;
const { validateOutcomeContract } = require("../../dist/cjs/outcome");
const root = path.resolve(__dirname, "../..");
const invalid = path.join(root, "examples/mirai-outcome-completion-invalid");
const load = (name) => JSON.parse(fs.readFileSync(path.join(invalid, name), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false }); addFormats(ajv);
const contractSchema = JSON.parse(fs.readFileSync(path.join(root, "schemas/outcome-completion-contract.schema.json"), "utf8"));
const validateContractSchema = ajv.compile(contractSchema);

if (validateOutcomeContract(load("effectful-ephemeral-contract.json")).valid) throw new Error("effectful_ephemeral_contract_accepted");
if (validateContractSchema(load("contract-grants-capability.json"))) throw new Error("capability_grant_property_accepted");
const missing = load("satisfied-with-missing-critical.json");
if (missing.status !== "satisfied" || !missing.unsupported_slots.includes("test_status")) throw new Error("false_satisfied_fixture_invalid");
const forged = load("forged-evidence-ref.json");
if (!forged.slots.some((slot) => slot.admitted_evidence_refs.includes("evidence.forged"))) throw new Error("forged_fixture_invalid");
const timeout = load("timeout-reported-complete.json");
if (timeout.assessment.status !== "satisfied" || timeout.candidate_context.availability !== "temporarily_unavailable") throw new Error("timeout_fixture_invalid");
process.stdout.write("Mirai 2.5 negative fixtures: PASS (fixtures are intentionally invalid and require semantic rejection)\n");
