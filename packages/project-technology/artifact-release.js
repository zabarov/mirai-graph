"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");

const REGISTRY_FILE = path.join("graph", "specs", "artifact-releases.json");
const DEFAULT_ROOT = path.join("artifacts", "matters");
const RELEASE_ID_RE = /^\d{8}-\d{2}$/;
const MATTER_ID_RE = /^[a-z0-9][a-z0-9._-]{1,79}$/;
const SAFE_DIRECTIONS = new Set(["inbound", "internal", "outbound"]);
const BLOCKED_EXTENSIONS = new Set([
  ".app", ".bat", ".cmd", ".com", ".dll", ".dmg", ".exe", ".hta", ".jar",
  ".js", ".jse", ".lnk", ".msi", ".pkg", ".ps1", ".scr", ".sh", ".vbs",
  ".docm", ".dotm", ".xlsm", ".xltm", ".pptm", ".potm", ".ppsm",
]);
const OS_NOISE = new Set([".DS_Store", "Thumbs.db"]);
const DEFAULT_LIMITS = Object.freeze({
  maxFiles: 1000,
  maxTotalBytes: 200 * 1024 * 1024,
  maxSingleBytes: 100 * 1024 * 1024,
  maxCompressionRatio: 100,
  maxArchiveDepth: 1,
});

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
}

function canonicalBytes(value) {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

function sha256(value, prefix = false) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  const digest = crypto.createHash("sha256").update(bytes).digest("hex");
  return prefix ? `sha256:${digest}` : digest;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  return value >>> 0;
});

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function result(action, mode, status, extra = {}) {
  return {
    schema_version: "1.0.0",
    operation_id: `mirai.project_technology.artifact.${action}`,
    operation_mode: mode,
    status,
    changed: false,
    blockers: [],
    warnings: [],
    next_action: "none",
    ...extra,
  };
}

function normalizeRepository(repository) {
  return path.resolve(repository || ".");
}

function safeRelative(input) {
  if (typeof input !== "string" || !input.trim() || /[\u0000-\u001f]/.test(input)) return null;
  const replaced = input.replace(/\\/g, "/").normalize("NFC");
  if (replaced.startsWith("/") || /^[A-Za-z]:\//.test(replaced)) return null;
  const normalized = path.posix.normalize(replaced).replace(/^\.\//, "");
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../")) return null;
  return normalized;
}

function safeMatterId(value) {
  return typeof value === "string" && MATTER_ID_RE.test(value) ? value : null;
}

function limits(options = {}) {
  const output = { ...DEFAULT_LIMITS };
  for (const key of Object.keys(output)) {
    if (Number.isInteger(options[key]) && options[key] > 0 && options[key] <= DEFAULT_LIMITS[key]) output[key] = options[key];
  }
  return output;
}

function extensionBlocked(relative) {
  return BLOCKED_EXTENSIONS.has(path.extname(relative).toLowerCase());
}

function nestedArchive(relative) {
  const lower = relative.toLowerCase();
  return lower.endsWith(".zip") || lower.endsWith(".tar") || lower.endsWith(".tar.gz") ||
    lower.endsWith(".tgz") || lower.endsWith(".rar") || lower.endsWith(".7z");
}

function ignoreNoise(relative) {
  const parts = relative.split("/");
  return parts[0] === "__MACOSX" || OS_NOISE.has(parts[parts.length - 1]);
}

function validateEntries(entries, inputLimits) {
  const blockers = [];
  const seen = new Set();
  let totalBytes = 0;
  if (entries.length > inputLimits.maxFiles) blockers.push("artifact_file_count_limit_exceeded");
  for (const entry of entries) {
    const relative = safeRelative(entry.path);
    if (!relative) {
      blockers.push("artifact_path_unsafe");
      continue;
    }
    const identity = relative.toLocaleLowerCase("en-US");
    if (seen.has(identity)) blockers.push("artifact_normalized_path_duplicate");
    seen.add(identity);
    const size = Number(entry.bytes?.length ?? entry.size ?? 0);
    totalBytes += size;
    if (size > inputLimits.maxSingleBytes) blockers.push("artifact_single_file_limit_exceeded");
    if (extensionBlocked(relative)) blockers.push("artifact_executable_or_macro_blocked");
    if (nestedArchive(relative)) blockers.push("artifact_nested_archive_blocked");
  }
  if (totalBytes > inputLimits.maxTotalBytes) blockers.push("artifact_total_size_limit_exceeded");
  return { blockers: [...new Set(blockers)].sort(), totalBytes };
}

function walkDirectory(root, current = root, output = []) {
  for (const name of fs.readdirSync(current).sort()) {
    const absolute = path.join(current, name);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error("artifact_symlink_blocked");
    if (stat.isDirectory()) walkDirectory(root, absolute, output);
    else if (stat.isFile()) output.push({
      path: path.relative(root, absolute).split(path.sep).join("/"),
      bytes: fs.readFileSync(absolute),
    });
    else throw new Error("artifact_special_file_blocked");
  }
  return output;
}

function zipRecords(bytes, inputLimits) {
  const blockers = [];
  const records = [];
  let offset = 0;
  let compressedTotal = 0;
  let uncompressedTotal = 0;
  let count = 0;
  while (offset + 46 <= bytes.length) {
    if (bytes.readUInt32LE(offset) !== 0x02014b50) {
      offset += 1;
      continue;
    }
    const flags = bytes.readUInt16LE(offset + 8);
    const compressed = bytes.readUInt32LE(offset + 20);
    const uncompressed = bytes.readUInt32LE(offset + 24);
    const fileNameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const externalAttributes = bytes.readUInt32LE(offset + 38);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const method = bytes.readUInt16LE(offset + 10);
    const madeBy = bytes.readUInt16LE(offset + 4) >> 8;
    const fileName = bytes.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    if (flags & 1) blockers.push("artifact_archive_encrypted");
    if (madeBy === 3 && (((externalAttributes >>> 16) & 0o170000) === 0o120000)) blockers.push("artifact_symlink_blocked");
    compressedTotal += compressed;
    uncompressedTotal += uncompressed;
    count += 1;
    records.push({ fileName, flags, method, compressed, uncompressed, localOffset });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  if (!count) blockers.push("artifact_zip_central_directory_missing");
  if (count > inputLimits.maxFiles) blockers.push("artifact_file_count_limit_exceeded");
  if (uncompressedTotal > inputLimits.maxTotalBytes) blockers.push("artifact_total_size_limit_exceeded");
  if (uncompressedTotal && uncompressedTotal / Math.max(1, compressedTotal) > inputLimits.maxCompressionRatio) blockers.push("artifact_compression_ratio_limit_exceeded");
  return { blockers: [...new Set(blockers)].sort(), records };
}

function parseZip(bytes, inputLimits) {
  const parsed = zipRecords(bytes, inputLimits);
  const blockers = parsed.blockers;
  if (blockers.length) return { entries: [], blockers };
  const entries = [];
  try {
    for (const record of parsed.records) {
      if (record.fileName.endsWith("/")) continue;
      if (bytes.readUInt32LE(record.localOffset) !== 0x04034b50) throw new Error("invalid local header");
      const nameLength = bytes.readUInt16LE(record.localOffset + 26);
      const extraLength = bytes.readUInt16LE(record.localOffset + 28);
      const start = record.localOffset + 30 + nameLength + extraLength;
      const compressed = bytes.subarray(start, start + record.compressed);
      if (compressed.length !== record.compressed) throw new Error("truncated data");
      let content;
      if (record.method === 0) content = Buffer.from(compressed);
      else if (record.method === 8) content = zlib.inflateRawSync(compressed, { maxOutputLength: inputLimits.maxSingleBytes + 1 });
      else throw new Error("unsupported compression");
      if (content.length !== record.uncompressed) throw new Error("size mismatch");
      entries.push({ path: record.fileName, bytes: content });
    }
  } catch (_) {
    return { entries: [], blockers: ["artifact_zip_invalid_or_compression_unsupported"] };
  }
  const normalized = entries.filter((entry) => !ignoreNoise(entry.path));
  return { entries: normalized, blockers: validateEntries(normalized, inputLimits).blockers };
}

function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, raw] of Object.entries(files).sort(([left], [right]) => left.localeCompare(right))) {
    const nameBytes = Buffer.from(name);
    const bytes = Buffer.from(raw);
    const compressed = zlib.deflateRawSync(bytes, { level: 6 });
    const checksum = crc32(bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x0021, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBytes, compressed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x0021, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE((0o100600 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBytes);
    offset += local.length + nameBytes.length + compressed.length;
  }
  const centralBytes = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  const count = Object.keys(files).length;
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralBytes, end]);
}

function parseTar(bytes, inputLimits) {
  const entries = [];
  const blockers = [];
  let offset = 0;
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, "");
    const relative = prefix ? `${prefix}/${name}` : name;
    const rawSize = header.subarray(124, 136).toString("ascii").replace(/\0.*$/, "").trim();
    const size = rawSize ? Number.parseInt(rawSize, 8) : 0;
    const type = String.fromCharCode(header[156] || 0);
    if (!Number.isFinite(size) || size < 0) {
      blockers.push("artifact_tar_invalid");
      break;
    }
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (dataEnd > bytes.length) {
      blockers.push("artifact_tar_invalid");
      break;
    }
    if (type === "1" || type === "2") blockers.push("artifact_symlink_or_hardlink_blocked");
    else if (type === "0" || type === "\0") entries.push({ path: relative, bytes: Buffer.from(bytes.subarray(dataStart, dataEnd)) });
    else if (type !== "5") blockers.push("artifact_tar_entry_type_unsupported");
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  const filtered = entries.filter((entry) => !ignoreNoise(entry.path));
  blockers.push(...validateEntries(filtered, inputLimits).blockers);
  return { entries: filtered, blockers: [...new Set(blockers)].sort() };
}

function inspectInput(inputPath, options = {}) {
  const inputLimits = limits(options);
  const absolute = path.resolve(String(inputPath || ""));
  if (!inputPath || !fs.existsSync(absolute)) return { blockers: ["artifact_input_missing"], entries: [] };
  const stat = fs.lstatSync(absolute);
  if (stat.isSymbolicLink()) return { blockers: ["artifact_input_symlink_blocked"], entries: [] };
  let entries = [];
  let blockers = [];
  let inputType = "files";
  let originalBytes = null;
  try {
    if (stat.isDirectory()) entries = walkDirectory(absolute);
    else if (stat.isFile()) {
      originalBytes = fs.readFileSync(absolute);
      const lower = absolute.toLowerCase();
      if (lower.endsWith(".zip")) {
        inputType = "zip";
        ({ entries, blockers } = parseZip(originalBytes, inputLimits));
      } else if (lower.endsWith(".tar")) {
        inputType = "tar";
        ({ entries, blockers } = parseTar(originalBytes, inputLimits));
      } else if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) {
        inputType = "tar.gz";
        let unpacked;
        try { unpacked = zlib.gunzipSync(originalBytes, { maxOutputLength: inputLimits.maxTotalBytes + 1 }); }
        catch (_) { return { blockers: ["artifact_gzip_invalid_or_limit_exceeded"], entries: [] }; }
        if (unpacked.length / Math.max(1, originalBytes.length) > inputLimits.maxCompressionRatio) blockers.push("artifact_compression_ratio_limit_exceeded");
        const parsed = parseTar(unpacked, inputLimits);
        entries = parsed.entries;
        blockers.push(...parsed.blockers);
      } else if (lower.endsWith(".rar") || lower.endsWith(".7z")) {
        return { blockers: ["artifact_archive_provider_required"], entries: [] };
      } else {
        entries = [{ path: path.basename(absolute), bytes: originalBytes }];
      }
    } else return { blockers: ["artifact_input_type_unsupported"], entries: [] };
  } catch (error) {
    return { blockers: [String(error.message || "artifact_input_invalid")], entries: [] };
  }
  const validated = validateEntries(entries, inputLimits);
  blockers.push(...validated.blockers);
  const normalized = entries.map((entry) => ({
    path: safeRelative(entry.path),
    bytes: entry.bytes,
    size: entry.bytes.length,
    sha256: sha256(entry.bytes),
  })).filter((entry) => entry.path).sort((a, b) => a.path.localeCompare(b.path));
  const inventory = normalized.map(({ path: relative, size, sha256: digest }) => ({ path: relative, size, sha256: digest }));
  return {
    blockers: [...new Set(blockers)].sort(),
    entries: normalized,
    input_type: inputType,
    input_name: stat.isFile() ? path.basename(absolute) : null,
    input_sha256: stat.isFile() ? sha256(originalBytes) : null,
    package_digest: sha256(canonicalBytes(inventory), true),
    file_count: normalized.length,
    total_bytes: normalized.reduce((sum, entry) => sum + entry.size, 0),
    inventory,
    absolute,
  };
}

function inspectArtifactBundle(repository, input, options = {}) {
  const inspected = inspectInput(input, options);
  return result("inspect", "read_only", inspected.blockers.length ? "blocked" : "success", {
    repository_id: path.basename(normalizeRepository(repository)),
    bundle: {
      input_type: inspected.input_type || null,
      file_count: inspected.file_count || 0,
      total_bytes: inspected.total_bytes || 0,
      package_digest: inspected.package_digest || null,
      files: inspected.inventory || [],
    },
    blockers: inspected.blockers,
    next_action: inspected.blockers.length ? "resolve the listed safe-input blockers" : "create a release preview or apply it",
  });
}

function registryPath(repository) {
  return path.join(repository, REGISTRY_FILE);
}

function emptyRegistry(repository) {
  return {
    schema_version: "1.0.0",
    operation_id: "mirai.project_technology.artifact_registry",
    repository_id: path.basename(repository),
    matters: [],
  };
}

function readRegistry(repository) {
  const file = registryPath(repository);
  if (!fs.existsSync(file)) return { registry: emptyRegistry(repository), bytes: null, blockers: [] };
  if (fs.lstatSync(file).isSymbolicLink()) return { registry: null, bytes: null, blockers: ["artifact_registry_symlink_unsafe"] };
  try {
    const bytes = fs.readFileSync(file);
    const registry = JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));
    if (!registry || registry.schema_version !== "1.0.0" || !Array.isArray(registry.matters)) throw new Error("invalid");
    return { registry, bytes, blockers: [] };
  } catch (_) {
    return { registry: null, bytes: null, blockers: ["artifact_registry_invalid"] };
  }
}

function registryDigest(registry) {
  return sha256(canonicalBytes(registry), true);
}

function normalizeArtifactRoot(repository, requested) {
  const relative = safeRelative(requested || DEFAULT_ROOT);
  if (!relative) return null;
  const absolute = path.resolve(repository, relative);
  return absolute.startsWith(`${repository}${path.sep}`) ? { relative, absolute } : null;
}

function datePrefix(value) {
  const date = value ? String(value).replace(/-/g, "") : new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return /^\d{8}$/.test(date) ? date : null;
}

function nextReleaseId(releases, prefix) {
  const sequence = releases.map((item) => String(item.release_id || ""))
    .filter((id) => id.startsWith(`${prefix}-`) && RELEASE_ID_RE.test(id))
    .map((id) => Number(id.slice(-2))).reduce((max, value) => Math.max(max, value), 0) + 1;
  return sequence <= 99 ? `${prefix}-${String(sequence).padStart(2, "0")}` : null;
}

function acquireLease(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    const descriptor = fs.openSync(file, "wx", 0o600);
    fs.writeFileSync(descriptor, canonicalBytes({ pid: process.pid, operation: "artifact_release" }));
    return descriptor;
  } catch (error) {
    if (error.code === "EEXIST") return null;
    throw error;
  }
}

function releaseLease(file, descriptor) {
  try { if (descriptor !== null) fs.closeSync(descriptor); } catch (_) { /* already closed */ }
  try { fs.unlinkSync(file); } catch (_) { /* best effort */ }
}

function writeEntries(root, entries) {
  for (const entry of entries) {
    const destination = path.join(root, ...entry.path.split("/"));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, entry.bytes, { mode: 0o600 });
  }
}

function findRelease(registry, matterId, releaseId) {
  const matter = registry.matters.find((item) => item.matter_id === matterId);
  return matter?.releases?.find((item) => item.release_id === releaseId) || null;
}

function manifestAt(repository, release) {
  const ref = safeRelative(release?.manifest_ref || "");
  if (!ref) return null;
  const absolute = path.resolve(repository, ref);
  if (!absolute.startsWith(`${repository}${path.sep}`) || !fs.existsSync(absolute) || fs.lstatSync(absolute).isSymbolicLink()) return null;
  try { return JSON.parse(fs.readFileSync(absolute, "utf8")); } catch (_) { return null; }
}

function compareInventories(baseManifest, targetManifest) {
  const base = new Map((baseManifest?.files || []).map((entry) => [entry.path, entry]));
  const target = new Map((targetManifest?.files || []).map((entry) => [entry.path, entry]));
  const added = [];
  const removed = [];
  const changed = [];
  const unchanged = [];
  for (const relative of [...new Set([...base.keys(), ...target.keys()])].sort()) {
    if (!base.has(relative)) added.push(relative);
    else if (!target.has(relative)) removed.push(relative);
    else if (base.get(relative).sha256 !== target.get(relative).sha256) changed.push(relative);
    else unchanged.push(relative);
  }
  return { added, removed, changed, unchanged };
}

function compareArtifactReleases(repository, baseReleaseId, targetReleaseId, options = {}) {
  const repo = normalizeRepository(repository);
  const loaded = readRegistry(repo);
  if (loaded.blockers.length) return result("compare", "read_only", "blocked", { blockers: loaded.blockers });
  const matterId = safeMatterId(options.matterId);
  if (!matterId) return result("compare", "read_only", "blocked", { blockers: ["artifact_matter_id_invalid"] });
  const base = findRelease(loaded.registry, matterId, baseReleaseId);
  const target = findRelease(loaded.registry, matterId, targetReleaseId);
  const blockers = [];
  if (!base) blockers.push("artifact_base_release_missing");
  if (!target) blockers.push("artifact_target_release_missing");
  const baseManifest = base ? manifestAt(repo, base) : null;
  const targetManifest = target ? manifestAt(repo, target) : null;
  if (base && !baseManifest) blockers.push("artifact_base_manifest_missing_or_invalid");
  if (target && !targetManifest) blockers.push("artifact_target_manifest_missing_or_invalid");
  return result("compare", "read_only", blockers.length ? "blocked" : "success", {
    matter_id: matterId,
    base_release_id: baseReleaseId,
    target_release_id: targetReleaseId,
    comparison: blockers.length ? null : compareInventories(baseManifest, targetManifest),
    blockers,
    next_action: blockers.length ? "repair or select existing immutable releases" : "use domain review to interpret the technical changes",
  });
}

function createArtifactRelease(repository, input, options = {}) {
  const repo = normalizeRepository(repository);
  const matterId = safeMatterId(options.matterId);
  const direction = SAFE_DIRECTIONS.has(options.direction) ? options.direction : null;
  const root = normalizeArtifactRoot(repo, options.artifactRoot);
  const blockers = [];
  if (!matterId) blockers.push("artifact_matter_id_invalid");
  if (!direction) blockers.push("artifact_direction_invalid");
  if (!root) blockers.push("artifact_root_unsafe");
  const inspected = inspectInput(input, options);
  blockers.push(...inspected.blockers);
  if (blockers.length) return result("release", options.apply ? "transactional" : "preview", "blocked", { blockers: [...new Set(blockers)].sort(), next_action: "resolve the listed release blockers" });
  const loaded = readRegistry(repo);
  if (loaded.blockers.length) return result("release", options.apply ? "transactional" : "preview", "blocked", { blockers: loaded.blockers });
  const currentDigest = registryDigest(loaded.registry);
  if (options.expectedGraphDigest && options.expectedGraphDigest !== currentDigest) {
    return result("release", options.apply ? "transactional" : "preview", "blocked", { blockers: ["artifact_registry_compare_and_swap_conflict"], current_graph_digest: currentDigest });
  }
  const matter = loaded.registry.matters.find((item) => item.matter_id === matterId);
  const releases = matter?.releases || [];
  const prefix = datePrefix(options.releaseDate);
  if (!prefix) return result("release", options.apply ? "transactional" : "preview", "blocked", { blockers: ["artifact_release_date_invalid"] });
  const requestedId = options.releaseId || nextReleaseId(releases, prefix);
  if (!requestedId || !RELEASE_ID_RE.test(requestedId)) return result("release", options.apply ? "transactional" : "preview", "blocked", { blockers: ["artifact_release_id_invalid_or_exhausted"] });
  const parents = [...new Set(options.parentReleaseIds || [])].sort();
  for (const parentId of parents) if (!findRelease(loaded.registry, matterId, parentId)) blockers.push("artifact_parent_release_missing");
  const duplicate = releases.find((item) => item.package_digest === inspected.package_digest && item.direction === direction && canonicalBytes(item.parent_release_ids || []) === canonicalBytes(parents));
  if (duplicate) return result("release", options.apply ? "transactional" : "preview", "success", {
    changed: false,
    matter_id: matterId,
    release_id: duplicate.release_id,
    package_digest: duplicate.package_digest,
    graph_digest: currentDigest,
    next_action: "none",
  });
  const existing = findRelease(loaded.registry, matterId, requestedId);
  if (existing) blockers.push("artifact_release_id_conflict");
  if (blockers.length) return result("release", options.apply ? "transactional" : "preview", "blocked", { blockers: [...new Set(blockers)].sort() });
  const planned = {
    matter_id: matterId,
    release_id: requestedId,
    direction,
    parent_release_ids: parents,
    file_count: inspected.file_count,
    total_bytes: inspected.total_bytes,
    package_digest: inspected.package_digest,
    artifact_root: root.relative,
  };
  if (!options.apply) return result("release", "preview", "preview", { planned_release: planned, apply_required: true, graph_digest: currentDigest, next_action: "rerun with --apply" });

  const matterRoot = path.join(root.absolute, matterId);
  const releasesRoot = path.join(matterRoot, "releases");
  const finalRoot = path.join(releasesRoot, requestedId);
  const leaseFile = path.join(matterRoot, ".artifact-release.lock");
  const lease = acquireLease(leaseFile);
  if (lease === null) return result("release", "transactional", "blocked", { blockers: ["artifact_release_lease_conflict"], next_action: "retry after the current release operation finishes" });
  let staging = null;
  try {
    const reloaded = readRegistry(repo);
    if (reloaded.blockers.length) throw new Error(reloaded.blockers[0]);
    if (registryDigest(reloaded.registry) !== currentDigest) throw new Error("artifact_registry_compare_and_swap_conflict");
    if (fs.existsSync(finalRoot)) throw new Error("artifact_release_id_conflict");
    fs.mkdirSync(releasesRoot, { recursive: true });
    staging = fs.mkdtempSync(path.join(releasesRoot, `.${requestedId}.tmp-`));
    writeEntries(path.join(staging, "package"), inspected.entries);
    fs.mkdirSync(path.join(staging, "original"), { recursive: true });
    const sourceStat = fs.lstatSync(inspected.absolute);
    if (sourceStat.isFile()) fs.copyFileSync(inspected.absolute, path.join(staging, "original", path.basename(inspected.absolute)));
    else writeEntries(path.join(staging, "original"), inspected.entries);
    fs.mkdirSync(path.join(staging, "changes"), { recursive: true });
    fs.mkdirSync(path.join(staging, "internal"), { recursive: true });
    const parentManifest = parents.length === 1 ? manifestAt(repo, findRelease(reloaded.registry, matterId, parents[0])) : null;
    const manifest = {
      schema_version: "1.0.0",
      operation_id: "mirai.project_technology.artifact_release_manifest",
      matter_id: matterId,
      release_id: requestedId,
      direction,
      parent_release_ids: parents,
      source: {
        kind: inspected.input_type,
        original_name: inspected.input_name,
        original_sha256: inspected.input_sha256,
      },
      files: inspected.inventory,
      file_count: inspected.file_count,
      total_bytes: inspected.total_bytes,
      package_digest: inspected.package_digest,
    };
    fs.writeFileSync(path.join(staging, "release-manifest.json"), canonicalBytes(manifest), { mode: 0o600 });
    const technical = {
      schema_version: "1.0.0",
      base_release_id: parents.length === 1 ? parents[0] : null,
      target_release_id: requestedId,
      comparison: compareInventories(parentManifest, manifest),
    };
    fs.writeFileSync(path.join(staging, "changes", "technical.json"), canonicalBytes(technical), { mode: 0o600 });
    if (typeof options.clientNote === "string" && options.clientNote.trim()) fs.writeFileSync(path.join(staging, "changes", "client.md"), `${options.clientNote.trim()}\n`, { mode: 0o600 });
    const manifestBytes = fs.readFileSync(path.join(staging, "release-manifest.json"));
    fs.renameSync(staging, finalRoot);
    staging = null;
    const releaseRef = path.relative(repo, finalRoot).split(path.sep).join("/");
    const record = {
      release_id: requestedId,
      direction,
      parent_release_ids: parents,
      storage_ref: releaseRef,
      manifest_ref: `${releaseRef}/release-manifest.json`,
      manifest_sha256: sha256(manifestBytes, true),
      package_digest: inspected.package_digest,
      state: options.state || "recorded",
    };
    const registry = structuredClone(reloaded.registry);
    let targetMatter = registry.matters.find((item) => item.matter_id === matterId);
    if (!targetMatter) {
      targetMatter = { matter_id: matterId, releases: [] };
      registry.matters.push(targetMatter);
    }
    targetMatter.releases.push(record);
    targetMatter.releases.sort((a, b) => a.release_id.localeCompare(b.release_id));
    registry.matters.sort((a, b) => a.matter_id.localeCompare(b.matter_id));
    const registryBytes = canonicalBytes(registry);
    fs.mkdirSync(path.dirname(registryPath(repo)), { recursive: true });
    const tempRegistry = `${registryPath(repo)}.${process.pid}.tmp`;
    fs.writeFileSync(tempRegistry, registryBytes);
    fs.renameSync(tempRegistry, registryPath(repo));
    const readback = readRegistry(repo);
    if (readback.blockers.length || !findRelease(readback.registry, matterId, requestedId)) throw new Error("artifact_release_readback_failed");
    let exportRef = null;
    let exportSha256 = null;
    if (options.createExport) {
      const exportRoot = path.join(matterRoot, "exports");
      fs.mkdirSync(exportRoot, { recursive: true });
      const exportFiles = {};
      for (const entry of inspected.entries) exportFiles[`package/${entry.path}`] = new Uint8Array(entry.bytes);
      const notePath = path.join(finalRoot, "changes", "client.md");
      if (fs.existsSync(notePath)) exportFiles["changes/client.md"] = new Uint8Array(fs.readFileSync(notePath));
      const archive = createZip(exportFiles);
      const exportPath = path.join(exportRoot, `${requestedId}.zip`);
      fs.writeFileSync(exportPath, archive, { mode: 0o600 });
      exportRef = path.relative(repo, exportPath).split(path.sep).join("/");
      exportSha256 = sha256(archive, true);
    }
    return result("release", "transactional", "success", {
      changed: true,
      ...planned,
      manifest_ref: record.manifest_ref,
      manifest_sha256: record.manifest_sha256,
      graph_digest: registryDigest(registry),
      export_ref: exportRef,
      export_sha256: exportSha256,
      terminal_receipt: sha256(canonicalBytes({ ...record, graph_digest: registryDigest(registry) }), true),
    });
  } catch (error) {
    if (staging && fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
    if (fs.existsSync(finalRoot)) fs.rmSync(finalRoot, { recursive: true, force: true });
    if (loaded.bytes) fs.writeFileSync(registryPath(repo), loaded.bytes);
    else if (fs.existsSync(registryPath(repo))) fs.rmSync(registryPath(repo), { force: true });
    return result("release", "transactional", "fail", {
      blockers: [String(error.message || "artifact_release_transaction_failed")],
      next_action: "inspect the blocker; the previous registry state was restored",
    });
  } finally {
    releaseLease(leaseFile, lease);
  }
}

function verifyArtifactRelease(repository, releaseId, options = {}) {
  const repo = normalizeRepository(repository);
  const matterId = safeMatterId(options.matterId);
  if (!matterId) return result("verify", "read_only", "blocked", { blockers: ["artifact_matter_id_invalid"] });
  const loaded = readRegistry(repo);
  if (loaded.blockers.length) return result("verify", "read_only", "blocked", { blockers: loaded.blockers });
  const record = findRelease(loaded.registry, matterId, releaseId);
  if (!record) return result("verify", "read_only", "blocked", { blockers: ["artifact_release_missing"] });
  const blockers = [];
  const manifest = manifestAt(repo, record);
  if (!manifest) blockers.push("artifact_manifest_missing_or_invalid");
  else {
    const manifestPath = path.resolve(repo, record.manifest_ref);
    const bytes = fs.readFileSync(manifestPath);
    if (sha256(bytes, true) !== record.manifest_sha256) blockers.push("artifact_manifest_digest_mismatch");
    if (manifest.package_digest !== record.package_digest) blockers.push("artifact_package_digest_mismatch");
    const releaseRoot = path.dirname(manifestPath);
    const entries = [];
    for (const file of manifest.files || []) {
      const relative = safeRelative(file.path);
      const absolute = relative ? path.join(releaseRoot, "package", ...relative.split("/")) : null;
      if (!absolute || !absolute.startsWith(`${path.join(releaseRoot, "package")}${path.sep}`) || !fs.existsSync(absolute) || fs.lstatSync(absolute).isSymbolicLink()) {
        blockers.push("artifact_package_file_missing_or_unsafe");
        continue;
      }
      const content = fs.readFileSync(absolute);
      if (sha256(content) !== file.sha256 || content.length !== file.size) blockers.push("artifact_package_file_digest_mismatch");
      entries.push({ path: relative, size: content.length, sha256: sha256(content) });
    }
    if (sha256(canonicalBytes(entries.sort((a, b) => a.path.localeCompare(b.path))), true) !== record.package_digest) blockers.push("artifact_package_digest_mismatch");
  }
  for (const parent of record.parent_release_ids || []) if (!findRelease(loaded.registry, matterId, parent)) blockers.push("artifact_parent_release_missing");
  return result("verify", "read_only", blockers.length ? "blocked" : "success", {
    matter_id: matterId,
    release_id: releaseId,
    package_digest: record.package_digest,
    manifest_ref: record.manifest_ref,
    graph_digest: registryDigest(loaded.registry),
    blockers: [...new Set(blockers)].sort(),
    next_action: blockers.length ? "restore the immutable release from a verified backup" : "none",
  });
}

function executeArtifact(repository, options = {}) {
  const action = options.artifactAction;
  if (action === "inspect") return inspectArtifactBundle(repository, options.input, options);
  if (action === "release") return createArtifactRelease(repository, options.input, options);
  if (action === "compare") return compareArtifactReleases(repository, options.baseReleaseId, options.targetReleaseId, options);
  if (action === "verify") return verifyArtifactRelease(repository, options.releaseId, options);
  return result(String(action || "unknown"), "read_only", "fail", { blockers: ["artifact_operation_unsupported"] });
}

module.exports = {
  DEFAULT_ROOT,
  REGISTRY_FILE,
  canonicalBytes,
  compareArtifactReleases,
  createArtifactRelease,
  executeArtifact,
  inspectArtifactBundle,
  sha256,
  verifyArtifactRelease,
};
