#!/usr/bin/env node

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const technology = require("../project-technology");

let passed = 0;
const failures = [];
function check(id, condition, detail = null) {
  if (condition) passed += 1;
  else failures.push({ id, detail });
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function repository(root, id) {
  const repo = path.join(root, id);
  fs.mkdirSync(repo, { recursive: true });
  writeJson(path.join(repo, "graph.json"), {
    $schema: "https://mirai-graph.dev/schemas/graph-manifest.schema.json",
    format: "mirai-graph",
    schema_version: "2.0.0",
    id,
    aliases: [],
    title: id,
    scope: "repository",
    kind: "project_graph",
    owner: "fixture",
    profiles: [],
    graph: { root: "graph", source_of_truth: ["graph/specs"], objects: [], relations: [], schemas: [], generated: [], raw_sources: [] },
    imports: [],
    extensions: { "mirai.project_technology": { contract_version: "1.0.0", enabled: true, context_policy: "task_scoped", source_boundary: "hybrid_sot" } },
  });
  return repo;
}

function octal(value, width) {
  return Buffer.from(value.toString(8).padStart(width - 1, "0") + "\0");
}

function tar(entries) {
  const output = [];
  for (const [name, content] of Object.entries(entries)) {
    const bytes = Buffer.from(content);
    const header = Buffer.alloc(512);
    Buffer.from(name).copy(header, 0, 0, 100);
    octal(0o600, 8).copy(header, 100);
    octal(0, 8).copy(header, 108);
    octal(0, 8).copy(header, 116);
    octal(bytes.length, 12).copy(header, 124);
    octal(0, 12).copy(header, 136);
    Buffer.from("        ").copy(header, 148);
    header[156] = "0".charCodeAt(0);
    Buffer.from("ustar\0").copy(header, 257);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    octal(checksum, 8).copy(header, 148);
    output.push(header, bytes, Buffer.alloc((512 - (bytes.length % 512)) % 512));
  }
  output.push(Buffer.alloc(1024));
  return Buffer.concat(output);
}

function rawZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const content = Buffer.from(entry.content || "");
    const compressed = zlib.deflateRawSync(content);
    const flags = entry.flags || 0x0800;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.claimedSize || content.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, compressed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.claimedSize || content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(entry.externalAttributes || 0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const centralBytes = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralBytes, end]);
}

function repoSnapshot(repo) {
  const files = [];
  function walk(current) {
    for (const name of fs.readdirSync(current).sort()) {
      const absolute = path.join(current, name);
      const stat = fs.lstatSync(absolute);
      if (stat.isDirectory()) walk(absolute);
      else if (stat.isFile()) files.push([path.relative(repo, absolute), crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex")]);
    }
  }
  walk(repo);
  return JSON.stringify(files);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-artifact-release-"));
const repo = repository(root, "artifact-project");
const input = path.join(root, "incoming");
fs.mkdirSync(input);
fs.writeFileSync(path.join(input, "contract.txt"), "version one\n");

const inspectBefore = repoSnapshot(repo);
const inspected = technology.inspectArtifactBundle(repo, input);
check("inspect_success", inspected.status === "success" && inspected.bundle.file_count === 1, inspected);
check("inspect_zero_write", repoSnapshot(repo) === inspectBefore);

const preview = technology.createArtifactRelease(repo, input, {
  matterId: "contract-main",
  direction: "inbound",
  artifactRoot: "documents/matters",
  releaseDate: "20260828",
});
check("release_preview", preview.status === "preview" && preview.operation_mode === "preview" && preview.changed === false, preview);
check("preview_zero_write", repoSnapshot(repo) === inspectBefore);

const first = technology.createArtifactRelease(repo, input, {
  matterId: "contract-main",
  direction: "inbound",
  artifactRoot: "documents/matters",
  releaseDate: "20260828",
  apply: true,
});
check("first_release_created", first.status === "success" && first.changed && first.release_id === "20260828-01", first);
check("first_release_verified", technology.verifyArtifactRelease(repo, first.release_id, { matterId: "contract-main" }).status === "success");

const repeated = technology.createArtifactRelease(repo, input, {
  matterId: "contract-main",
  direction: "inbound",
  artifactRoot: "documents/matters",
  releaseDate: "20260828",
  apply: true,
});
check("same_release_idempotent", repeated.status === "success" && repeated.changed === false && repeated.release_id === first.release_id, repeated);

fs.writeFileSync(path.join(input, "contract.txt"), "version two\n");
fs.writeFileSync(path.join(input, "appendix.txt"), "appendix\n");
const second = technology.createArtifactRelease(repo, input, {
  matterId: "contract-main",
  direction: "outbound",
  artifactRoot: "documents/matters",
  releaseDate: "20260828",
  parentReleaseIds: [first.release_id],
  clientNote: "Обновлены условия и добавлено приложение.",
  createExport: true,
  apply: true,
});
check("second_release_numbered", second.status === "success" && second.release_id === "20260828-02", second);
check("client_export_created", Boolean(second.export_ref && fs.existsSync(path.join(repo, second.export_ref))), second);
const compared = technology.compareArtifactReleases(repo, first.release_id, second.release_id, { matterId: "contract-main" });
check("comparison_detects_changes", compared.status === "success" && compared.comparison.added.includes("appendix.txt") && compared.comparison.changed.includes("contract.txt"), compared);

const readOnlySnapshot = repoSnapshot(repo);
check("verify_success", technology.verifyArtifactRelease(repo, second.release_id, { matterId: "contract-main" }).status === "success");
check("compare_and_verify_zero_write", repoSnapshot(repo) === readOnlySnapshot);
const exportedInspect = technology.inspectArtifactBundle(repo, path.join(repo, second.export_ref));
check("generated_zip_is_readable", exportedInspect.status === "success" && exportedInspect.bundle.file_count === 3, exportedInspect);

const secondFile = path.join(repo, "documents/matters/contract-main/releases/20260828-02/package/contract.txt");
const secondBytes = fs.readFileSync(secondFile);
fs.writeFileSync(secondFile, "tampered\n");
check("tampered_file_blocked", technology.verifyArtifactRelease(repo, second.release_id, { matterId: "contract-main" }).blockers.includes("artifact_package_file_digest_mismatch"));
fs.writeFileSync(secondFile, secondBytes);

check("missing_parent_blocked", technology.createArtifactRelease(repo, input, {
  matterId: "contract-main", direction: "internal", artifactRoot: "documents/matters",
  releaseDate: "20260829", parentReleaseIds: ["20260101-01"], apply: true,
}).blockers.includes("artifact_parent_release_missing"));
check("stale_cas_blocked", technology.createArtifactRelease(repo, input, {
  matterId: "contract-main", direction: "internal", artifactRoot: "documents/matters",
  releaseDate: "20260829", expectedGraphDigest: "sha256:" + "0".repeat(64), apply: true,
}).blockers.includes("artifact_registry_compare_and_swap_conflict"));

const lease = path.join(repo, "documents/matters/contract-main/.artifact-release.lock");
fs.writeFileSync(lease, "busy");
check("concurrent_lease_blocked", technology.createArtifactRelease(repo, input, {
  matterId: "contract-main", direction: "internal", artifactRoot: "documents/matters",
  releaseDate: "20260829", apply: true,
}).blockers.includes("artifact_release_lease_conflict"));
fs.unlinkSync(lease);

const other = technology.createArtifactRelease(repo, input, {
  matterId: "nda-secondary", direction: "inbound", artifactRoot: "documents/matters",
  releaseDate: "20260828", apply: true,
});
check("multiple_matters_independent", other.status === "success" && other.release_id === "20260828-01", other);

const tarPath = path.join(root, "safe.tar");
fs.writeFileSync(tarPath, tar({ "folder/agreement.txt": "safe\n" }));
check("tar_supported", technology.inspectArtifactBundle(repo, tarPath).status === "success");
const tgzPath = path.join(root, "safe.tar.gz");
fs.writeFileSync(tgzPath, zlib.gzipSync(fs.readFileSync(tarPath)));
check("tar_gz_supported", technology.inspectArtifactBundle(repo, tgzPath).status === "success");

const unsafeTar = path.join(root, "unsafe.tar");
fs.writeFileSync(unsafeTar, tar({ "../escape.txt": "unsafe\n" }));
check("traversal_blocked", technology.inspectArtifactBundle(repo, unsafeTar).blockers.includes("artifact_path_unsafe"));
const unsafeZip = path.join(root, "unsafe.zip");
fs.writeFileSync(unsafeZip, rawZip([{ name: "../escape.txt", content: "unsafe" }]));
check("zip_traversal_blocked", technology.inspectArtifactBundle(repo, unsafeZip).blockers.includes("artifact_path_unsafe"));
const encryptedZip = path.join(root, "encrypted.zip");
fs.writeFileSync(encryptedZip, rawZip([{ name: "contract.txt", content: "secret", flags: 0x0801 }]));
check("encrypted_zip_blocked", technology.inspectArtifactBundle(repo, encryptedZip).blockers.includes("artifact_archive_encrypted"));
const duplicateZip = path.join(root, "duplicate.zip");
fs.writeFileSync(duplicateZip, rawZip([{ name: "Contract.txt", content: "a" }, { name: "contract.txt", content: "b" }]));
check("normalized_duplicate_blocked", technology.inspectArtifactBundle(repo, duplicateZip).blockers.includes("artifact_normalized_path_duplicate"));
const symlinkZip = path.join(root, "symlink.zip");
fs.writeFileSync(symlinkZip, rawZip([{ name: "contract-link", content: "target", externalAttributes: (0o120777 << 16) >>> 0 }]));
check("zip_symlink_blocked", technology.inspectArtifactBundle(repo, symlinkZip).blockers.includes("artifact_symlink_blocked"));
const bombZip = path.join(root, "bomb.zip");
fs.writeFileSync(bombZip, rawZip([{ name: "large.txt", content: "a", claimedSize: 50 * 1024 * 1024 }]));
check("compression_ratio_blocked", technology.inspectArtifactBundle(repo, bombZip).blockers.includes("artifact_compression_ratio_limit_exceeded"));
const executable = path.join(root, "payload.exe");
fs.writeFileSync(executable, "not executable");
check("executable_blocked", technology.inspectArtifactBundle(repo, executable).blockers.includes("artifact_executable_or_macro_blocked"));
const unsupported = path.join(root, "bundle.7z");
fs.writeFileSync(unsupported, "fixture");
check("unsupported_archive_blocked", technology.inspectArtifactBundle(repo, unsupported).blockers.includes("artifact_archive_provider_required"));

if (process.platform !== "win32") {
  const symlink = path.join(root, "input-link");
  fs.symlinkSync(input, symlink);
  check("input_symlink_blocked", technology.inspectArtifactBundle(repo, symlink).blockers.includes("artifact_input_symlink_blocked"));
}

const registryText = fs.readFileSync(path.join(repo, "graph/specs/artifact-releases.json"), "utf8");
check("registry_has_no_host_path", !registryText.includes(root));
check("registry_has_no_document_content", !registryText.includes("version two") && !registryText.includes("Обновлены условия"));

const folder = repository(root, "shared-folder");
const folderInput = path.join(root, "folder-input.txt");
fs.writeFileSync(folderInput, "same bytes\n");
const folderRelease = technology.createArtifactRelease(folder, folderInput, {
  matterId: "matter-one", direction: "inbound", releaseDate: "20260828", apply: true,
});
check("plain_folder_supported", folderRelease.status === "success", folderRelease);
const folderRepeat = technology.createArtifactRelease(folder, folderInput, {
  matterId: "matter-one", direction: "inbound", releaseDate: "20260828", apply: true,
});
check("plain_folder_repeat_byte_identical", folderRepeat.changed === false);

const report = {
  schema_version: "1.0.0",
  operation_id: "mirai.project_technology.artifact_release_validation",
  status: failures.length ? "fail" : "success",
  passed,
  failed: failures.length,
  failures,
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
fs.rmSync(root, { recursive: true, force: true });
process.exitCode = failures.length ? 1 : 0;
