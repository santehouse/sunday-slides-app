/**
 * Run sheet text extraction (sections 15/27 of BUILD_HANDOFF.md): DOCX via
 * `mammoth`, PDF via `unpdf`. Produces lightly-structured plain text
 * (`# heading`, `- list item`, blank-line-separated paragraphs) so the
 * OpenAI parsing step gets enough order/structure to work with, without
 * carrying full markup. Pure/server, no database access.
 */

import mammoth from "mammoth";
import { extractText as unpdfExtractText, getDocumentProxy } from "unpdf";

export const MAX_RUN_SHEET_BYTES = 10 * 1024 * 1024;

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

export class UnsupportedFileError extends Error {
  constructor(mimeType: string, filename: string) {
    super(`Unsupported run sheet file type: ${mimeType || "unknown"} (${filename})`);
    this.name = "UnsupportedFileError";
  }
}

export class EmptyExtractionError extends Error {
  constructor(filename: string) {
    super(`No usable text could be extracted from ${filename}`);
    this.name = "EmptyExtractionError";
  }
}

export class FileTooLargeError extends Error {
  constructor(size: number, max: number) {
    super(`File is ${size} bytes, which exceeds the ${max}-byte limit`);
    this.name = "FileTooLargeError";
  }
}

export interface ExtractTextResult {
  text: string;
  /** Page count, when known (PDF only). */
  pages?: number;
  warnings: string[];
}

type DetectedType = "docx" | "pdf";

function detectType(mimeType: string, filename: string): DetectedType | null {
  const lowerMime = mimeType.toLowerCase();
  const extension = filename.toLowerCase().split(".").pop();

  if (lowerMime === DOCX_MIME || extension === "docx") return "docx";
  if (lowerMime === PDF_MIME || extension === "pdf") return "pdf";
  return null;
}

/**
 * Extracts normalized plain text from a DOCX or PDF run sheet.
 *
 * @throws {FileTooLargeError} if `buffer` exceeds {@link MAX_RUN_SHEET_BYTES}.
 * @throws {UnsupportedFileError} if the mime type/extension isn't DOCX or PDF.
 * @throws {EmptyExtractionError} if extraction produces only whitespace/noise.
 */
export async function extractText(
  buffer: Uint8Array,
  mimeType: string,
  filename: string,
): Promise<ExtractTextResult> {
  if (buffer.byteLength > MAX_RUN_SHEET_BYTES) {
    throw new FileTooLargeError(buffer.byteLength, MAX_RUN_SHEET_BYTES);
  }

  const type = detectType(mimeType, filename);
  if (!type) {
    throw new UnsupportedFileError(mimeType, filename);
  }

  const result = type === "docx" ? await extractDocx(buffer) : await extractPdf(buffer);

  const cleaned = stripNoise(result.text);
  if (cleaned.trim() === "") {
    throw new EmptyExtractionError(filename);
  }

  return { ...result, text: cleaned };
}

async function extractDocx(buffer: Uint8Array): Promise<ExtractTextResult> {
  const nodeBuffer = Buffer.from(buffer);
  const { value: html, messages } = await mammoth.convertToHtml({ buffer: nodeBuffer });
  const text = htmlToStructuredText(html);
  const warnings = messages.map((message) => message.message);
  return { text, warnings };
}

async function extractPdf(buffer: Uint8Array): Promise<ExtractTextResult> {
  const pdf = await getDocumentProxy(buffer);
  const { totalPages, text } = await unpdfExtractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  const joined = pages
    .map((pageText, index) => `--- Page ${index + 1} ---\n${pageText.trim()}`)
    .join("\n\n");
  return { text: joined, pages: totalPages, warnings: [] };
}

// --- DOCX HTML → structured plain text -------------------------------------------------------

type BlockType = "heading" | "list" | "row" | "para";

interface Block {
  type: BlockType;
  text: string;
}

const BLOCK_REGEX = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>|<li[^>]*>([\s\S]*?)<\/li>|<tr[^>]*>([\s\S]*?)<\/tr>|<p[^>]*>([\s\S]*?)<\/p>/gi;
const CELL_REGEX = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

function stripTags(fragment: string): string {
  return fragment
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Converts mammoth's HTML output into lightly-structured plain text:
 * headings become `# Title`, list items become `- item`, table rows become
 * a single `cell / cell` line (so a two-column roster table doesn't get
 * mistaken for two separate announcements), and paragraphs are separated by
 * blank lines. Consecutive list items / table rows stay tight (single
 * newline) so they still read as one block.
 */
function htmlToStructuredText(html: string): string {
  const blocks: Block[] = [];
  let match: RegExpExecArray | null;

  BLOCK_REGEX.lastIndex = 0;
  while ((match = BLOCK_REGEX.exec(html)) !== null) {
    if (match[1] !== undefined) {
      const text = stripTags(match[2] ?? "");
      if (text) blocks.push({ type: "heading", text: `# ${text}` });
    } else if (match[3] !== undefined) {
      const text = stripTags(match[3]);
      if (text) blocks.push({ type: "list", text: `- ${text}` });
    } else if (match[4] !== undefined) {
      const cells = Array.from(match[4].matchAll(CELL_REGEX))
        .map((cellMatch) => stripTags(cellMatch[1]))
        .filter((cell) => cell !== "");
      const text = cells.join(" / ");
      if (text) blocks.push({ type: "row", text });
    } else if (match[5] !== undefined) {
      const text = stripTags(match[5]);
      if (text) blocks.push({ type: "para", text });
    }
  }

  let out = "";
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    out += block.text;
    const next = blocks[i + 1];
    if (next) {
      const tight = block.type === next.type && (block.type === "list" || block.type === "row");
      out += tight ? "\n" : "\n\n";
    }
  }
  return out;
}

/** Strips visual separator noise (long underscore/dash runs) left over from signature lines etc. */
function stripNoise(text: string): string {
  return text
    .replace(/[_-]{5,}/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
