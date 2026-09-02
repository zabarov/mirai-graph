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

const SECRET_MATERIAL = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bghp_[A-Za-z0-9]{20,}\b|\bxoxb-[A-Za-z0-9-]{20,}\b|\bAKIA[0-9A-Z]{16}\b|(?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*["']?[A-Za-z0-9_./+\-=]{8,}/i;

function containsSecretMaterial(value: unknown): boolean {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return SECRET_MATERIAL.test(text);
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

function textUnits(item: SourceSnapshotItem, payload: SourcePayload, text: string, section = "document"): NormalizedUnit[] {
  const parts = text.replace(/\r\n/g, "\n").split(/\n{2,}/).map((value) => value.trim()).filter(Boolean);
  return (parts.length ? parts : [""]).map((value, index) => unit(item, payload, index + 1, "document_fragment", value, { section: `${section}.${index + 1}` }));
}

const textConverter: ContentConverter = {
  id: "mirai.converter.text",
  version: "1.0.0",
  supports(mediaType, key) { return mediaType.startsWith("text/") && !/html|csv/.test(mediaType) || /\.(?:md|txt)$/i.test(key); },
  async convert(payload, item) { return textUnits(item, payload, Buffer.from(payload.content).toString("utf8")); }
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
  async convert(payload, item) {
    const lines = Buffer.from(payload.content).toString("utf8").replace(/\r\n/g, "\n").split("\n").filter(Boolean);
    if (!lines.length) return [];
    const parse = (line: string): string[] => {
      const result: string[] = []; let value = ""; let quoted = false;
      for (let index = 0; index < line.length; index += 1) {
        const char = line[index] as string;
        if (char === '"' && line[index + 1] === '"' && quoted) { value += '"'; index += 1; }
        else if (char === '"') quoted = !quoted;
        else if (char === "," && !quoted) { result.push(value); value = ""; }
        else value += char;
      }
      if (quoted) throw new Error("csv_unclosed_quote");
      result.push(value); return result;
    };
    const headers = parse(lines[0] as string);
    const rows = lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, parse(line)[index] ?? ""])));
    return [unit(item, payload, 1, "table", rows)];
  }
};

const htmlConverter: ContentConverter = {
  id: "mirai.converter.html",
  version: "1.0.0",
  supports(mediaType, key) { return mediaType === "text/html" || /\.html?$/i.test(key); },
  async convert(payload, item) {
    const document = parseDocument(Buffer.from(payload.content).toString("utf8"), { decodeEntities: true });
    return textUnits(item, payload, DomUtils.textContent(document).replace(/\s+/g, " ").trim(), "html");
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

function collectXmlValues(value: unknown, keys: Set<string>, output: string[]): void {
  if (Array.isArray(value)) return value.forEach((item) => collectXmlValues(item, keys, output));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (keys.has(key) && typeof child === "string") output.push(child);
    else collectXmlValues(child, keys, output);
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
    collectXmlValues(xmlParser.parse(Buffer.from(document).toString("utf8")), new Set(["w:t"]), values);
    return textUnits(item, payload, values.join(" "), "docx");
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
    for (const [name, content] of worksheets) {
      const values: string[] = [];
      collectXmlValues(xmlParser.parse(Buffer.from(content).toString("utf8")), new Set(["v", "t"]), values);
      units.push(unit(item, payload, units.length + 1, "table", values, { sheet: path.basename(name, ".xml") }));
    }
    return units;
  }
};

export const BUILTIN_CONVERTERS: ContentConverter[] = [structuredConverter, csvConverter, htmlConverter, pdfConverter, docxConverter, xlsxConverter, textConverter];

export async function convertPayloads(snapshot: SourceSnapshot, payloads: SourcePayload[], budget: SourceBudget, converters: ContentConverter[] = BUILTIN_CONVERTERS): Promise<ConversionResult> {
  const byKey = new Map(snapshot.items.map((item) => [item.key, item]));
  const units: NormalizedUnit[] = [];
  const diagnostics: ConversionResult["diagnostics"] = [];
  for (const payload of payloads.sort((a, b) => a.key.localeCompare(b.key))) {
    const item = byKey.get(payload.key);
    if (!item) throw new Error(`source_snapshot_item_missing:${payload.key}`);
    const converter = converters.find((candidate) => candidate.supports(payload.media_type, payload.key));
    if (!converter) {
      diagnostics.push({ source_ref: `${item.source_id}#${item.key}`, code: "converter_unavailable", severity: "warning", message: `No converter is registered for ${payload.media_type}.`, converter_proposal_required: true });
      continue;
    }
    try {
      const converted = await converter.convert(payload, item, budget);
      if (converted.some((value) => containsSecretMaterial(value.content))) {
        diagnostics.push({ source_ref: `${item.source_id}#${item.key}`, code: "secret_bearing_content_blocked", severity: "blocking", message: "Normalized content matched a secret-bearing pattern and was excluded.", converter_proposal_required: false });
        continue;
      }
      units.push(...converted);
    } catch (error) {
      diagnostics.push({ source_ref: `${item.source_id}#${item.key}`, code: "conversion_failed", severity: "blocking", message: error instanceof Error ? error.message : String(error), converter_proposal_required: false });
    }
  }
  return { units: units.sort((a, b) => a.id.localeCompare(b.id)), diagnostics, raw_source_persisted: false, canonical_write_allowed: false };
}
