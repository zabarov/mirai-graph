"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/@?=+*-]{1,255}$/;
const ACTIVE_LIFECYCLES = new Set(["reviewed", "accepted", "active"]);
const SECRET_MARKERS = ["password", "secret", "token", "cookie", "private_key", "totp", ".env"];

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
}

function canonicalBytes(value) {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

function sha256(value, prefix = true) {
  const digest = crypto.createHash("sha256").update(Buffer.from(String(value))).digest("hex");
  return prefix ? `sha256:${digest}` : digest;
}

function result(action, status, extra = {}) {
  return {
    schema_version: "1.0.0",
    operation_id: `mirai.project_technology.course.${action}`,
    operation_mode: "read_only",
    status,
    changed: false,
    blockers: [],
    warnings: [],
    next_action: "none",
    ...extra,
  };
}

function readJson(file) {
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute) || fs.lstatSync(absolute).isSymbolicLink()) throw new Error("unsafe_or_missing_json_input");
  return JSON.parse(fs.readFileSync(absolute, "utf8").replace(/^\uFEFF/, ""));
}

function unwrapCoursePack(value) {
  return value && typeof value === "object" && !Array.isArray(value) && value.course_pack
    ? value.course_pack
    : value;
}

function uniqueStrings(value, field, blockers, required = true) {
  if (!Array.isArray(value) || (required && value.length === 0)) {
    blockers.push(`technology_${field}_empty`);
    return [];
  }
  const output = [];
  for (const item of value) {
    if (typeof item !== "string" || !SAFE_ID.test(item)) blockers.push(`technology_${field}_unsafe`);
    else output.push(item);
  }
  return [...new Set(output)];
}

function normalizeTechnology(input) {
  const blockers = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return { technology: {}, blockers: ["technology_contract_missing"] };
  const technology = {
    schema_version: String(input.schema_version || "1.0.0"),
    id: String(input.id || ""),
    title: String(input.title || ""),
    owner: String(input.owner || ""),
    outcome: String(input.outcome || ""),
    lifecycle: String(input.lifecycle || ""),
    version: String(input.version || ""),
    source_refs: uniqueStrings(input.source_refs || [], "source_refs", blockers),
    projection_refs: uniqueStrings(input.projection_refs || [], "projection_refs", blockers, false),
  };
  for (const field of ["id", "owner"]) if (!SAFE_ID.test(technology[field])) blockers.push(`technology_${field}_missing_or_unsafe`);
  for (const field of ["title", "outcome", "version"]) if (!technology[field].trim()) blockers.push(`technology_${field}_missing`);
  if (!ACTIVE_LIFECYCLES.has(technology.lifecycle)) blockers.push("technology_lifecycle_not_executable");

  const operationIds = new Set();
  technology.operations = [];
  if (!Array.isArray(input.operations) || input.operations.length === 0) blockers.push("technology_operations_empty");
  else for (const raw of input.operations) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) { blockers.push("technology_operation_invalid"); continue; }
    const operation = {
      id: String(raw.id || ""), title: String(raw.title || ""), summary: String(raw.summary || ""),
      owner: String(raw.owner || ""), capability_ref: String(raw.capability_ref || ""),
      prerequisites: uniqueStrings(raw.prerequisites || [], "operation_prerequisites", blockers, false),
      input_refs: uniqueStrings(raw.input_refs || [], "operation_input_refs", blockers, false),
      output_refs: uniqueStrings(raw.output_refs || [], "operation_output_refs", blockers),
      check_refs: uniqueStrings(raw.check_refs || [], "operation_check_refs", blockers),
      stop_condition_refs: uniqueStrings(raw.stop_condition_refs || [], "operation_stop_condition_refs", blockers, false),
      rollback_refs: uniqueStrings(raw.rollback_refs || [], "operation_rollback_refs", blockers, false),
      source_refs: uniqueStrings(raw.source_refs || [], "operation_source_refs", blockers),
      instructional_refs: uniqueStrings(raw.instructional_refs || [], "operation_instructional_refs", blockers, false),
      applicability: Array.isArray(raw.applicability) ? [...new Set(raw.applicability.map(String))].sort() : [],
      negative_boundaries: Array.isArray(raw.negative_boundaries) ? [...new Set(raw.negative_boundaries.map(String))].sort() : [],
    };
    for (const field of ["id", "owner", "capability_ref"]) if (!SAFE_ID.test(operation[field])) blockers.push(`technology_operation_${field}_missing_or_unsafe`);
    if (!operation.title || !operation.summary) blockers.push("technology_operation_explanation_missing");
    if (operationIds.has(operation.id)) blockers.push("technology_operation_duplicate");
    operationIds.add(operation.id); technology.operations.push(operation);
  }

  technology.scenarios = [];
  if (!Array.isArray(input.scenarios) || input.scenarios.length === 0) blockers.push("technology_scenarios_empty");
  else {
    const scenarioIds = new Set();
    for (const raw of input.scenarios) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) { blockers.push("technology_scenario_invalid"); continue; }
      const scenario = {
        id: String(raw.id || ""), title: String(raw.title || ""), outcome: String(raw.outcome || ""),
        operation_ids: uniqueStrings(raw.operation_ids || [], "scenario_operation_ids", blockers),
        required_inputs: uniqueStrings(raw.required_inputs || [], "scenario_required_inputs", blockers, false),
        audience: Array.isArray(raw.audience) ? [...new Set(raw.audience.map(String))].sort() : [],
      };
      if (!SAFE_ID.test(scenario.id)) blockers.push("technology_scenario_id_missing_or_unsafe");
      if (!scenario.title || !scenario.outcome) blockers.push("technology_scenario_explanation_missing");
      if (scenarioIds.has(scenario.id)) blockers.push("technology_scenario_duplicate");
      scenarioIds.add(scenario.id);
      for (const id of scenario.operation_ids) if (!operationIds.has(id)) blockers.push("technology_scenario_operation_unknown");
      technology.scenarios.push(scenario);
    }
  }
  for (const operation of technology.operations) for (const dependency of operation.prerequisites) if (!operationIds.has(dependency)) blockers.push("technology_operation_prerequisite_unknown");

  const visiting = new Set(); const visited = new Set(); const byId = new Map(technology.operations.map((item) => [item.id, item]));
  function visit(id) {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const dependency of (byId.get(id) || {}).prerequisites || []) if (visit(dependency)) return true;
    visiting.delete(id); visited.add(id); return false;
  }
  if ([...byId.keys()].some(visit)) blockers.push("technology_required_dependency_cycle");
  return { technology, blockers: [...new Set(blockers)].sort() };
}

function technologyDigest(technology) {
  return sha256(canonicalBytes(technology));
}

function resolveClosure(operations, selectedIds, blockers) {
  const byId = new Map(operations.map((item) => [item.id, item]));
  const output = []; const seen = new Set();
  function add(id) {
    if (seen.has(id)) return;
    const operation = byId.get(id);
    if (!operation) { blockers.push("course_required_operation_missing"); return; }
    for (const dependency of operation.prerequisites) add(dependency);
    seen.add(id); output.push(operation);
  }
  for (const id of selectedIds) add(id);
  return output;
}

function compileTechnologyCourse(repository, options = {}) {
  let raw;
  try { raw = options.technology || readJson(options.technologyFile); }
  catch (error) { return result("compile", "blocked", { blockers: [String(error.message || error)], next_action: "provide a valid executable technology contract" }); }
  const normalized = normalizeTechnology(raw);
  const blockers = [...normalized.blockers];
  if (blockers.length) return result("compile", "blocked", { blockers, next_action: "repair the executable technology contract" });
  const scenarioIds = options.scenarioIds && options.scenarioIds.length ? options.scenarioIds : normalized.technology.scenarios.map((item) => item.id);
  const scenarios = normalized.technology.scenarios.filter((item) => scenarioIds.includes(item.id));
  if (scenarios.length !== new Set(scenarioIds).size) blockers.push("course_scenario_unknown");
  const selectedOperationIds = scenarios.flatMap((item) => item.operation_ids);
  const operations = resolveClosure(normalized.technology.operations, selectedOperationIds, blockers);
  const audience = String(options.audience || "learner");
  if (!SAFE_ID.test(audience)) blockers.push("course_audience_unsafe");
  if (blockers.length) return result("compile", "blocked", { blockers: [...new Set(blockers)].sort(), next_action: "repair the technology or course selection" });
  const technology_digest = technologyDigest(normalized.technology);
  const packBase = {
    schema_version: "1.0.0",
    technology_id: normalized.technology.id,
    technology_title: normalized.technology.title,
    technology_outcome: normalized.technology.outcome,
    technology_version: normalized.technology.version,
    technology_digest,
    audience,
    scenario_ids: scenarios.map((item) => item.id),
    source_refs: normalized.technology.source_refs,
    source_revisions: options.sourceRevisions || {},
    scenarios,
    sections: operations.map((item, index) => ({
      order: index + 1,
      technology_node_id: item.id,
      title: item.title,
      summary: item.summary,
      owner: item.owner,
      capability_ref: item.capability_ref,
      prerequisite_ids: item.prerequisites,
      input_refs: item.input_refs,
      output_refs: item.output_refs,
      check_refs: item.check_refs,
      stop_condition_refs: item.stop_condition_refs,
      rollback_refs: item.rollback_refs,
      source_refs: item.source_refs,
      instructional_refs: item.instructional_refs,
    })),
    exercises: options.exercises || [],
    checks: [...new Set(operations.flatMap((item) => item.check_refs))].sort(),
    omissions: [],
    limitations: [],
  };
  const context = { ...packBase, course_pack_digest: sha256(canonicalBytes(packBase)) };
  return result("compile", "success", { repository: path.resolve(repository || "."), course_pack: context });
}

function verifyTechnologyCourse(repository, options = {}) {
  let pack;
  try { pack = unwrapCoursePack(options.coursePack || readJson(options.coursePackFile)); }
  catch (error) { return result("verify", "blocked", { blockers: [String(error.message || error)] }); }
  const blockers = [];
  const digest = pack.course_pack_digest;
  const base = { ...pack }; delete base.course_pack_digest;
  if (digest !== sha256(canonicalBytes(base))) blockers.push("course_pack_digest_mismatch");
  if (!Array.isArray(pack.sections) || pack.sections.length === 0) blockers.push("course_sections_empty");
  const ids = new Set();
  for (const section of pack.sections || []) {
    if (!SAFE_ID.test(String(section.technology_node_id || ""))) blockers.push("course_section_identity_missing");
    if (ids.has(section.technology_node_id)) blockers.push("course_section_duplicate");
    ids.add(section.technology_node_id);
    if (!section.title || !section.summary || !section.owner || !section.capability_ref) blockers.push("course_section_incomplete");
  }
  const serialized = JSON.stringify(pack).toLowerCase();
  for (const marker of SECRET_MARKERS) if (serialized.includes(`\"${marker}\":`)) blockers.push("course_pack_secret_field_forbidden");
  return result("verify", blockers.length ? "blocked" : "success", { blockers: [...new Set(blockers)].sort(), course_pack_digest: digest, next_action: blockers.length ? "recompile the course from current accepted technology" : "none" });
}

function reconcileTechnologyCourse(repository, options = {}) {
  let pack; let projection;
  try {
    pack = unwrapCoursePack(options.coursePack || readJson(options.coursePackFile));
    projection = options.projection || readJson(options.projectionFile);
  } catch (error) { return result("reconcile", "blocked", { blockers: [String(error.message || error)] }); }
  const verified = verifyTechnologyCourse(repository, { coursePack: pack });
  if (verified.status !== "success") return result("reconcile", "blocked", { blockers: verified.blockers, next_action: verified.next_action });
  if (projection.course_pack_digest !== pack.course_pack_digest) return result("reconcile", "blocked", { blockers: ["course_projection_source_stale"], next_action: "re-export the projection or explicitly reconcile against its source pack" });
  const base = new Map(pack.sections.map((item) => [item.technology_node_id, item]));
  const seen = new Set(); const changes = [];
  for (const current of projection.sections || []) {
    const id = current.technology_node_id;
    if (!base.has(id)) { changes.push({ type: "semantic_proposal", technology_node_id: id || null, reason: "course_section_added" }); continue; }
    seen.add(id); const previous = base.get(id);
    const semanticFields = ["owner", "capability_ref", "prerequisite_ids", "input_refs", "output_refs", "check_refs", "stop_condition_refs", "rollback_refs", "source_refs"];
    const semantic = semanticFields.some((field) => canonicalBytes(previous[field] || null) !== canonicalBytes(current[field] || null));
    const editorial = previous.title !== current.title || previous.summary !== current.summary || canonicalBytes(previous.instructional_refs || []) !== canonicalBytes(current.instructional_refs || []);
    if (semantic) changes.push({ type: "semantic_proposal", technology_node_id: id, reason: "executable_contract_changed" });
    else if (editorial) changes.push({ type: "editorial", technology_node_id: id, reason: "instructional_projection_changed" });
  }
  for (const id of base.keys()) if (!seen.has(id)) changes.push({ type: "semantic_proposal", technology_node_id: id, reason: "required_course_section_removed" });
  const semantic = changes.filter((item) => item.type === "semantic_proposal");
  return result("reconcile", semantic.length ? "needs_decision" : "success", {
    changes,
    semantic_proposals: semantic,
    editorial_changes: changes.filter((item) => item.type === "editorial"),
    canonical_write_allowed: false,
    next_action: semantic.length ? "send semantic proposals to the technology owners" : changes.length ? "apply editorial changes through the documentation owner" : "none",
  });
}

function executeCourse(repository, options = {}) {
  const action = options.courseAction;
  if (action === "compile") return compileTechnologyCourse(repository, options);
  if (action === "verify") return verifyTechnologyCourse(repository, options);
  if (action === "reconcile") return reconcileTechnologyCourse(repository, options);
  return result(String(action || "unknown"), "fail", { blockers: ["unsupported_technology_course_action"] });
}

module.exports = {
  canonicalBytes,
  compileTechnologyCourse,
  executeCourse,
  normalizeTechnology,
  reconcileTechnologyCourse,
  technologyDigest,
  verifyTechnologyCourse,
};
