/**
 * Composes extraction → OpenAI parsing into one call (sections 15/16/38 of
 * BUILD_HANDOFF.md). Manual upload and email intake both go through this
 * same pipeline. Returns typed failure results instead of throwing so
 * callers can render a status without a try/catch at every call site.
 */

import { extractText } from "@/lib/run-sheets/extract";
import { parseRunSheetText, type MappingContext, type ParseRunSheetResult, type TemplateContext } from "@/lib/openai/client";
import type { ParsedRunSheet } from "@/lib/domain/types";

export interface ProcessRunSheetContext {
  mappings: MappingContext[];
  templates: TemplateContext[];
  serviceDateHint?: string | null;
  localeHint?: "en" | "fr" | "mixed" | null;
}

export interface ProcessRunSheetInput {
  buffer: Uint8Array;
  mimeType: string;
  filename: string;
  context: ProcessRunSheetContext;
  /** Injectable for tests — defaults to the real `parseRunSheetText`. */
  parse?: typeof parseRunSheetText;
}

export interface ProcessRunSheetSuccess {
  ok: true;
  extractedText: string;
  parsed: ParsedRunSheet;
  raw: unknown;
  warnings: string[];
}

export interface ProcessRunSheetFailure {
  ok: false;
  stage: "extract" | "parse";
  error: string;
}

export type ProcessRunSheetResult = ProcessRunSheetSuccess | ProcessRunSheetFailure;

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Runs the shared extract → parse pipeline used by both manual upload and email intake. */
export async function processRunSheet(input: ProcessRunSheetInput): Promise<ProcessRunSheetResult> {
  const parse = input.parse ?? parseRunSheetText;

  let extraction: Awaited<ReturnType<typeof extractText>>;
  try {
    extraction = await extractText(input.buffer, input.mimeType, input.filename);
  } catch (error) {
    return { ok: false, stage: "extract", error: describeError(error) };
  }

  let parseResult: ParseRunSheetResult;
  try {
    parseResult = await parse({
      text: extraction.text,
      localeHint: input.context.localeHint,
      mappings: input.context.mappings,
      templates: input.context.templates,
      serviceDateHint: input.context.serviceDateHint ?? null,
    });
  } catch (error) {
    return { ok: false, stage: "parse", error: describeError(error) };
  }

  return {
    ok: true,
    extractedText: extraction.text,
    parsed: parseResult.parsed,
    raw: parseResult.raw,
    warnings: extraction.warnings,
  };
}
