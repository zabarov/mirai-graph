import path from "node:path";
import YAML from "yaml";
import { parseDocument, DomUtils } from "htmlparser2";
import { unzip } from "fflate";
import { XMLParser } from "fast-xml-parser";
import { digestValue } from "../core/canonical.js";
import {
  NORMALIZED_UNIT_CONTRACT_VERSION,
  type ContentConverter,
  type ConversionResult,
  type NormalizedUnit,
  type SourceBudget,
  type SourcePayload,
  type SourceSnapshot,
  type SourceSnapshotItem
} from "./types.js";

const SECRET_MATERIAL = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bghp_[A-Za-z0-9]{20,}\b|\bxoxb-[A-Za-z0-9-]{20,}\b|\bAKIA[0-9A-Z]{16}\b|(?:^|[\s,{])["']?[A-Za-z0-9_.-]*(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)[A-Za-z0-9_.-]*["']?\s*[:=]\s*["']?[^\s"',}\]]{4,}/im;

function isSecretKey(key: string): boolean {
  const normalized = key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[-.]/g, "_").toLowerCase();
  return /(?:^|_)(?:password|passwd|secret|token)$/.test(normalized)
    || /(?:^|_)(?:api|access|refresh|private|client|auth)_(?:key|token|secret)$/.test(normalized)
    || /^(?:authorization|cookie|bearer|session_id|session_token)$/.test(normalized);
}

function containsSecretMaterial(value: unknown): boolean {
  const seen = new WeakSet<object>();
  const inspect = (candidate: unknown): boolean => {
    if (typeof candidate === "string") return SECRET_MATERIAL.test(candidate);
    if (!candidate || typeof candidate !== "object") return false;
    if (seen.has(candidate)) return true;
    seen.add(candidate);
    if (Array.isArray(candidate)) return candidate.some(inspect);
    return Object.entries(candidate as Record<string, unknown>).some(([key, child]) => isSecretKey(key) || inspect(child));
  };
  return inspect(value);
}

function safeConversionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return /^[a-z][a-z0-9_]*(?::[A-Za-z0-9._/-]+)?$/.test(message) ? message : "converter_parse_or_execution_failed";
}

function assertConversionBudget(budget: SourceBudget): void {
  for (const [name, value] of Object.entries(budget)) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`source_budget_invalid:${name}`);
  }
}

function assertConversionDeadline(deadline: number): void {
  if (Date.now() > deadline) throw new Error("conversion_timeout");
}

function unit(item: SourceSnapshotItem, payload: SourcePayload, ordinal: number, kind: NormalizedUnit["kind"], content: NormalizedUnit["content"], span?: NormalizedUnit["source_span"]): NormalizedUnit {
  const contentDigest = digestValue(content);
  return {
    contract_version: NORMALIZED_UNIT_CONTRACT_VERSION,
    id: `unit.${contentDigest.slice(7, 23)}.${ordinal}`,
    source_ref: `${item.source_id}#${item.key}`,
    source_fingerprint: item.fingerprint,
    kind,
    media_type: payload.media_type,
    ordinal,
    content,
    content_digest: contentDigest,
    ...(span ? { source_span: span } : {}),
    authority: item.authority,
    scope: item.scope,
    confidentiality: item.confidentiality,
    instructions_authorized: false
  };
}

function textUnits(item: SourceSnapshotItem, payload: SourcePayload, text: string, budget: SourceBudget, section = "document"): NormalizedUnit[] {
  const normalized = text.replace(/\r\n/g, "\n");
  const units: NormalizedUnit[] = [];
  const separator = /\n{2,}/g;
  const deadline = Date.now() + budget.timeout_ms;
  let cursor = 0;
  let normalizedBytes = 0;
  const append = (value: string): void => {
    const content = value.trim();
    if (!content) return;
    if (units.length >= budget.max_items) throw new Error("normalized_unit_budget_exceeded");
    const bytes = Buffer.byteLength(JSON.stringify(content));
    if (bytes > budget.max_item_bytes) throw new Error("normalized_unit_bytes_exceeded");
    normalizedBytes += bytes;
    if (normalizedBytes > budget.max_total_bytes) throw new Error("normalized_total_bytes_exceeded");
    units.push(unit(item, payload, units.length + 1, "document_fragment", content, { section: `${section}.${units.length + 1}` }));
  };
  for (let match = separator.exec(normalized); match; match = separator.exec(normalized)) {
    assertConversionDeadline(deadline);
    append(normalized.slice(cursor, match.index));
    cursor = match.index + match[0].length;
  }
  append(normalized.slice(cursor));
  if (!units.length) units.push(unit(item, payload, 1, "document_fragment", "", { section: `${section}.1` }));
  return units;
}

const textConverter: ContentConverter = {
  id: "mirai.converter.text",
  version: "1.0.0",
  supports(mediaType, key) { return mediaType.startsWith("text/") && !/html|csv/.test(mediaType) || /\.(?:md|txt)$/i.test(key); },
  async convert(payload, item, budget) { return textUnits(item, payload, Buffer.from(payload.content).toString("utf8"), budget); }
};

const structuredConverter: ContentConverter = {
  id: "mirai.converter.structured",
  version: "1.0.0",
  supports(mediaType, key) { return /json|yaml|yml/i.test(mediaType) || /\.(?:json|ya?ml)$/i.test(key); },
  async convert(payload, item) {
    const text = Buffer.from(payload.content).toString("utf8");
    const value = /json/i.test(payload.media_type) || /\.json$/i.test(payload.key) ? JSON.parse(text) : YAML.parse(text, { maxAliasCount: 0 });
    return [unit(item, payload, 1, Array.isArray(value) ? "table" : "record", value as Record<string, unknown> | unknown[])];
  }
};

const csvConverter: ContentConverter = {
  id: "mirai.converter.csv",
  version: "1.0.0",
  supports(mediaType, key) { return mediaType === "text/csv" || /\.csv$/i.test(key); },
  async convert(payload, item, budget) {
    const text = Buffer.from(payload.content).toString("utf8").replace(/\r\n/g, "\n");
    const deadline = Date.now() + budget.timeout_ms;
    const parse = (line: string): string[] => {
      const result: string[] = []; let value = ""; let quoted = false;
      for (let index = 0; index < line.length; index += 1) {
        if (index % 1024 === 0) assertConversionDeadline(deadline);
        const char = line[index] as string;
        if (char === '"' && line[index + 1] === '"' && quoted) { value += '"'; index += 1; }
        else if (char === '"') quoted = !quoted;
        else if (char === "," && !quoted) { result.push(value); value = ""; }
        else value += char;
      }
      if (quoted) throw new Error("csv_unclosed_quote");
      result.push(value); return result;
    };
    let headers: string[] | undefined;
    const rows: Record<string, string>[] = [];
    let normalizedBytes = 0;
    let cursor = 0;
    for (let index = 0; index <= text.length; index += 1) {
      if (index < text.length && text[index] !== "\n") continue;
      assertConversionDeadline(deadline);
      const line = text.slice(cursor, index);
      cursor = index + 1;
      if (!line) continue;
      if (!headers) { headers = parse(line); continue; }
      if (rows.length >= budget.max_items) throw new Error("csv_row_budget_exceeded");
      const values = parse(line);
      const row = Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]));
      normalizedBytes += Buffer.byteLength(JSON.stringify(row));
      if (normalizedBytes > budget.max_item_bytes || normalizedBytes > budget.max_total_bytes) throw new Error("normalized_unit_bytes_exceeded");
      rows.push(row);
    }
    if (!headers) return [];
    return [unit(item, payload, 1, "table", rows)];
  }
};

const htmlConverter: ContentConverter = {
  id: "mirai.converter.html",
  version: "1.0.0",
  supports(mediaType, key) { return mediaType === "text/html" || /\.html?$/i.test(key); },
  async convert(payload, item, budget) {
    const document = parseDocument(Buffer.from(payload.content).toString("utf8"), { decodeEntities: true });
    return textUnits(item, payload, DomUtils.textContent(document).replace(/\s+/g, " ").trim(), budget, "html");
  }
};

const pdfConverter: ContentConverter = {
  id: "mirai.converter.pdf",
  version: "1.0.0",
  supports(mediaType, key) { return mediaType === "application/pdf" || /\.pdf$/i.test(key); },
  async convert(payload, item, budget) {
    if (payload.content.byteLength > budget.max_item_bytes) throw new Error("pdf_input_budget_exceeded");
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const document = await pdfjs.getDocument({ data: payload.content, isEvalSupported: false }).promise;
    const units: NormalizedUnit[] = [];
    if (document.numPages > Math.min(budget.max_items, 2000)) throw new Error("pdf_page_budget_exceeded");
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map((entry) => "str" in entry ? entry.str : "").join(" ").replace(/\s+/g, " ").trim();
      units.push(unit(item, payload, pageNumber, "document_fragment", text, { page: pageNumber }));
    }
    return units;
  }
};

function findZipEndOfCentralDirectory(content: Uint8Array): number {
  const view = new DataView(content.buffer, content.byteOffset, content.byteLength);
  const minimum = Math.max(0, content.byteLength - 65_557);
  for (let offset = content.byteLength - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new Error("archive_central_directory_missing");
}

function assertSafeArchive(content: Uint8Array, budget: SourceBudget): void {
  const view = new DataView(content.buffer, content.byteOffset, content.byteLength);
  const endOffset = findZipEndOfCentralDirectory(content);
  const disk = view.getUint16(endOffset + 4, true);
  const centralDisk = view.getUint16(endOffset + 6, true);
  const diskEntries = view.getUint16(endOffset + 8, true);
  const totalEntries = view.getUint16(endOffset + 10, true);
  const centralSize = view.getUint32(endOffset + 12, true);
  const centralOffset = view.getUint32(endOffset + 16, true);
  if (disk !== 0 || centralDisk !== 0 || diskEntries !== totalEntries) throw new Error("archive_multidisk_forbidden");
  if (totalEntries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) throw new Error("archive_zip64_unsupported");
  if (totalEntries > budget.max_items || centralOffset + centralSize > endOffset) throw new Error("archive_central_directory_invalid");

  let offset = centralOffset;
  let expandedBytes = 0;
  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > endOffset || view.getUint32(offset, true) !== 0x02014b50) throw new Error("archive_central_entry_invalid");
    const compressedBytes = view.getUint32(offset + 20, true);
    const uncompressedBytes = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const externalAttributes = view.getUint32(offset + 38, true);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (next > endOffset) throw new Error("archive_central_entry_invalid");
    const name = Buffer.from(content.subarray(offset + 46, offset + 46 + nameLength)).toString("utf8").replace(/\\/g, "/");
    const normalized = path.posix.normalize(name);
    const unixMode = externalAttributes >>> 16;
    if (!name || name.startsWith("/") || normalized === ".." || normalized.startsWith("../")) throw new Error("archive_path_escape");
    if ((unixMode & 0o170000) === 0o120000) throw new Error("archive_symlink_forbidden");
    if (uncompressedBytes > budget.max_item_bytes) throw new Error("archive_entry_budget_exceeded");
    if (compressedBytes > 0 && uncompressedBytes / compressedBytes > 200) throw new Error("archive_compression_ratio_exceeded");
    expandedBytes += uncompressedBytes;
    if (expandedBytes > budget.max_total_bytes) throw new Error("archive_expansion_budget_exceeded");
    offset = next;
  }
  if (offset !== centralOffset + centralSize) throw new Error("archive_central_directory_size_mismatch");
}

function unzipBounded(content: Uint8Array, budget: SourceBudget): Promise<Record<string, Uint8Array>> {
  if (content.byteLength > budget.max_item_bytes) return Promise.reject(new Error("archive_input_budget_exceeded"));
  try {
    assertSafeArchive(content, budget);
  } catch (error) {
    return Promise.reject(error);
  }
  return new Promise((resolve, reject) => {
    unzip(content, { filter: (file) => {
      const name = file.name.replace(/\\/g, "/");
      const normalized = path.posix.normalize(name);
      return Boolean(name) && !name.startsWith("/") && normalized !== ".." && !normalized.startsWith("../");
    } }, (error, files) => {
      if (error) return reject(error);
      const entries = Object.entries(files);
      const total = entries.reduce((sum, [, value]) => sum + value.byteLength, 0);
      if (entries.length > budget.max_items || total > budget.max_total_bytes || entries.some(([, value]) => value.byteLength > budget.max_item_bytes)) return reject(new Error("archive_expansion_budget_exceeded"));
      resolve(files);
    });
  });
}

const xmlParser = new XMLParser({ ignoreAttributes: false, processEntities: false, allowBooleanAttributes: false, parseTagValue: false, trimValues: false });

function collectXmlValues(value: unknown, keys: Set<string>, output: string[], budget: SourceBudget, state: { bytes: number; deadline: number }, depth = 0): void {
  assertConversionDeadline(state.deadline);
  if (depth > 256) throw new Error("xml_depth_budget_exceeded");
  if (Array.isArray(value)) {
    for (const item of value) collectXmlValues(item, keys, output, budget, state, depth + 1);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (keys.has(key) && typeof child === "string") {
      if (output.length >= budget.max_items) throw new Error("xml_value_budget_exceeded");
      state.bytes += Buffer.byteLength(child);
      if (state.bytes > budget.max_item_bytes || state.bytes > budget.max_total_bytes) throw new Error("xml_value_bytes_exceeded");
      output.push(child);
    } else collectXmlValues(child, keys, output, budget, state, depth + 1);
  }
}

const docxConverter: ContentConverter = {
  id: "mirai.converter.docx",
  version: "1.0.0",
  supports(mediaType, key) { return mediaType.includes("wordprocessingml") || /\.docx$/i.test(key); },
  async convert(payload, item, budget) {
    const files = await unzipBounded(payload.content, budget);
    const document = files["word/document.xml"];
    if (!document) throw new Error("docx_document_xml_missing");
    const values: string[] = [];
    collectXmlValues(xmlParser.parse(Buffer.from(document).toString("utf8")), new Set(["w:t"]), values, budget, { bytes: 0, deadline: Date.now() + budget.timeout_ms });
    return textUnits(item, payload, values.join(" "), budget, "docx");
  }
};

const xlsxConverter: ContentConverter = {
  id: "mirai.converter.xlsx",
  version: "1.0.0",
  supports(mediaType, key) { return mediaType.includes("spreadsheetml") || /\.xlsx$/i.test(key); },
  async convert(payload, item, budget) {
    const files = await unzipBounded(payload.content, budget);
    const units: NormalizedUnit[] = [];
    const worksheets = Object.entries(files).filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort(([a], [b]) => a.localeCompare(b));
    if (!worksheets.length) throw new Error("xlsx_worksheet_missing");
    const state = { bytes: 0, deadline: Date.now() + budget.timeout_ms };
    for (const [name, content] of worksheets) {
      if (units.length >= budget.max_items) throw new Error("normalized_unit_budget_exceeded");
      const values: string[] = [];
      collectXmlValues(xmlParser.parse(Buffer.from(content).toString("utf8")), new Set(["v", "t"]), values, budget, state);
      units.push(unit(item, payload, units.length + 1, "table", values, { sheet: path.basename(name, ".xml") }));
    }
    return units;
  }
};

export const BUILTIN_CONVERTERS: ContentConverter[] = [structuredConverter, csvConverter, htmlConverter, pdfConverter, docxConverter, xlsxConverter, textConverter];

export async function convertPayloads(snapshot: SourceSnapshot, payloads: SourcePayload[], budget: SourceBudget, converters: ContentConverter[] = BUILTIN_CONVERTERS): Promise<ConversionResult> {
  assertConversionBudget(budget);
  if (payloads.length > budget.max_items) throw new Error("source_item_budget_exceeded");
  let inputBytes = 0;
  for (const payload of payloads) {
    if (payload.content.byteLength > budget.max_item_bytes) throw new Error(`source_item_bytes_exceeded:${payload.key}`);
    inputBytes += payload.content.byteLength;
    if (inputBytes > budget.max_total_bytes) throw new Error("source_total_bytes_exceeded");
  }
  const byKey = new Map(snapshot.items.map((item) => [item.key, item]));
  const units: NormalizedUnit[] = [];
  const diagnostics: ConversionResult["diagnostics"] = [];
  const deadline = Date.now() + budget.timeout_ms;
  let normalizedBytes = 0;
  for (const payload of payloads.sort((a, b) => a.key.localeCompare(b.key))) {
    const item = byKey.get(payload.key);
    if (!item) throw new Error(`source_snapshot_item_missing:${payload.key}`);
    const converter = converters.find((candidate) => candidate.supports(payload.media_type, payload.key));
    if (!converter) {
      diagnostics.push({ source_ref: `${item.source_id}#${item.key}`, code: "converter_unavailable", severity: "warning", message: `No converter is registered for ${payload.media_type}.`, converter_proposal_required: true });
      continue;
    }
    try {
      const remainingMs = deadline - Date.now();
      if (remainingMs < 1) throw new Error("conversion_timeout");
      const remainingItems = budget.max_items - units.length;
      const remainingBytes = budget.max_total_bytes - normalizedBytes;
      if (remainingItems < 1) throw new Error("normalized_unit_budget_exceeded");
      if (remainingBytes < 1) throw new Error("normalized_total_bytes_exceeded");
      const converterBudget = { ...budget, max_items: remainingItems, max_total_bytes: remainingBytes, timeout_ms: remainingMs };
      let timer: ReturnType<typeof setTimeout> | undefined;
      const converted = await Promise.race([
        converter.convert(payload, item, converterBudget),
        new Promise<NormalizedUnit[]>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("conversion_timeout")), remainingMs); })
      ]).finally(() => { if (timer) clearTimeout(timer); });
      if (Date.now() > deadline) throw new Error("conversion_timeout");
      if (converted.some((value) => containsSecretMaterial(value.content))) {
        diagnostics.push({ source_ref: `${item.source_id}#${item.key}`, code: "secret_bearing_content_blocked", severity: "blocking", message: "Normalized content matched a secret-bearing pattern and was excluded.", converter_proposal_required: false });
        continue;
      }
      if (units.length + converted.length > budget.max_items) throw new Error("normalized_unit_budget_exceeded");
      for (const convertedUnit of converted) {
        const bytes = Buffer.byteLength(JSON.stringify(convertedUnit.content));
        if (bytes > budget.max_item_bytes) throw new Error("normalized_unit_bytes_exceeded");
        normalizedBytes += bytes;
        if (normalizedBytes > budget.max_total_bytes) throw new Error("normalized_total_bytes_exceeded");
      }
      units.push(...converted);
    } catch (error) {
      diagnostics.push({ source_ref: `${item.source_id}#${item.key}`, code: "conversion_failed", severity: "blocking", message: safeConversionError(error), converter_proposal_required: false });
    }
  }
  return { units: units.sort((a, b) => a.id.localeCompare(b.id)), diagnostics, raw_source_persisted: false, canonical_write_allowed: false };
}
