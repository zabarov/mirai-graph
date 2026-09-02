"use strict";

const fs = require("fs");
const path = require("path");

const EXPORT_REF = ".mirai/evidence/project-technology/target-provider-export.json";

function isCapsule(repo, manifest) {
  return manifest?.graph?.root === "mirai/graph"
    || fs.existsSync(path.join(repo, "mirai/manifest.yaml"))
    || fs.existsSync(path.join(repo, "mirai/manifest.lock.json"));
}

function confinedPath(repo, relative, allowMissing = false) {
  // Check even dangling symlinks; an output path must not redirect a local export.
  const { resolveConfinedPath } = require("../../dist/cjs/core");
  const filename = resolveConfinedPath(repo, relative, { allow_missing: allowMissing, label: "provider_capsule_path" });
  let cursor = fs.realpathSync(repo);
  for (const part of path.relative(cursor, filename).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    try {
      if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error("provider_capsule_symlink");
    } catch (error) {
      if (error.code !== "ENOENT" || !allowMissing) throw error;
    }
  }
  return filename;
}

function load(repo) {
  const project = require("../../dist/cjs/project");
  for (const ref of ["graph.json", "mirai/manifest.yaml"]) confinedPath(repo, ref);
  confinedPath(repo, "mirai/manifest.lock.json", true);
  const manifest = project.readProjectManifest(repo);
  confinedPath(repo, manifest.documentation.start, true);
  confinedPath(repo, manifest.documentation.owner_notes, true);
  const validation = project.validateProjectCapsule(repo);
  if (!validation.valid) throw new Error("provider_capsule_lock_or_start_invalid");
  const facade = JSON.parse(fs.readFileSync(confinedPath(repo, "graph.json"), "utf8"));
  const expected = project.createLegacyFacade(validation.lock.manifest, facade);
  const { digestValue } = require("../../dist/cjs/core");
  for (const key of ["id", "owner", "profiles", "graph"]) {
    if (digestValue(facade[key]) !== digestValue(expected[key])) throw new Error("provider_capsule_facade_mismatch");
  }
  const records = [];
  const ids = new Set();
  let totalBytes = 0;
  for (const ref of manifest.entrypoints.graph.objects) {
    const file = confinedPath(repo, ref);
    const size = fs.statSync(file).size;
    totalBytes += size;
    if (size > 2 * 1024 * 1024 || totalBytes > 16 * 1024 * 1024) throw new Error("provider_capsule_object_budget_exceeded");
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    const objects = Array.isArray(value) ? value : [value];
    for (const object of objects) {
      if (!object || typeof object !== "object" || Array.isArray(object) || typeof object.id !== "string" || !object.id) throw new Error("provider_capsule_object_invalid");
      if (ids.has(object.id)) throw new Error("provider_capsule_duplicate_identity");
      if (ids.size >= 10000) throw new Error("provider_capsule_object_budget_exceeded");
      ids.add(object.id);
      records.push({ object, file, relative: ref });
    }
  }
  const revisionRefs = ["graph.json", "mirai/manifest.yaml", "mirai/manifest.lock.json", manifest.documentation.start,
    ...manifest.entrypoints.graph.objects, ...manifest.entrypoints.graph.relations, manifest.entrypoints.sources];
  if (fs.existsSync(confinedPath(repo, manifest.documentation.owner_notes, true))) revisionRefs.push(manifest.documentation.owner_notes);
  return { records, revisionRefs: [...new Set(revisionRefs)], lockDigest: validation.lock.digest };
}

function exportPath(repo) {
  const { manifest } = require("../../dist/cjs/project").validateProjectCapsule(repo).lock || {};
  if (!manifest) throw new Error("provider_capsule_lock_or_start_invalid");
  const inputs = [manifest.entrypoints.graph.root, ...Object.values(manifest.entrypoints).filter((entry) => typeof entry === "string")];
  if (inputs.some((ref) => ref === "." || EXPORT_REF === ref || EXPORT_REF.startsWith(`${ref.replace(/\/$/, "")}/`))) throw new Error("provider_export_overlaps_capsule_input");
  return confinedPath(repo, EXPORT_REF, true);
}

module.exports = { EXPORT_REF, isCapsule, load, exportPath };
