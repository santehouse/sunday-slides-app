/**
 * OpenAI structured-output run-sheet parser (section 17 of
 * BUILD_HANDOFF.md). The actual model call is injected (`callModel`) so this
 * module is fully unit-testable offline — no network in tests.
 *
 * `import "server-only"` makes an accidental import from a Client Component a build
 * error (CLAUDE.md rule 10 — the API key is read in `createResponsesCallModel()`).
 * Vitest and `scripts/tsconfig.json` alias `server-only` to a no-op stub, so this
 * module stays importable offline; unit tests always inject a fake `callModel`.
 */
import "server-only";

import OpenAI from "openai";
import type { ParsedRunSheet, TemplateCategory } from "@/lib/domain/types";
import { parsedRunSheetJsonSchema, parsedRunSheetSchema } from "@/lib/openai/schema";

export interface MappingContext {
  canonicalKey: string;
  canonicalName: string;
  aliases: string[];
}

export interface TemplateContext {
  id: string;
  slug: string;
  nameEn: string;
  category: TemplateCategory;
}

export interface ParseRunSheetInput {
  text: string;
  /** Best-guess document language, if known ahead of time (e.g. from a prior parse). */
  localeHint?: "en" | "fr" | "mixed" | null;
  mappings: MappingContext[];
  templates: TemplateContext[];
  serviceDateHint?: string | null;
}

export interface CallModelParams {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: Record<string, unknown>;
  schemaName: string;
}

export interface CallModelResult {
  outputText: string;
  raw: unknown;
}

/** Injectable seam over the OpenAI SDK call, so tests never touch the network. */
export type CallModel = (params: CallModelParams) => Promise<CallModelResult>;

export interface ParseRunSheetResult {
  parsed: ParsedRunSheet;
  raw: unknown;
  model: string;
}

export class ParseValidationError extends Error {
  raw: unknown;

  constructor(message: string, raw: unknown) {
    super(message);
    this.name = "ParseValidationError";
    this.raw = raw;
  }
}

const SCHEMA_NAME = "parsed_run_sheet";

const SYSTEM_PROMPT = `You are the run-sheet parser for Church Panels, a church slide production tool.

You will be given the extracted text of a weekly church "run sheet" (a Word or PDF document a pastor sends listing that Sunday's announcements), a list of already-known recurring announcement mappings, and a list of available slide templates.

Your job:
- Identify the document's sections and split each one into individual announcements.
- Understand both English and French text; announcements may be in either language, or the document may mix both.
- Identify recurring announcements (weekly/monthly items like a Bible study, a men's or women's gathering, giving/offering information) even when their exact wording changes week to week.
- Extract any date/time information into line1/line2 as written; do not invent or infer a date/time that is not stated.
- Preserve the exact original wording of each announcement's sourceText and headline. Never rewrite, paraphrase, correct spelling, or translate the content. If the source says "MATINALES" (a typo), keep "MATINALES".
- headline should be the announcement's title, written the way it appears in the source (typically uppercase or title case as written) — short, no trailing punctuation.
- Only ever suggest a canonicalKey that exactly matches one of the provided mapping canonicalKey values (matching against that mapping's canonicalName or aliases). If nothing in the provided list matches, canonicalKey MUST be null. Never invent a new canonicalKey.
- Only ever suggest a suggestedTemplateId that exactly matches one of the provided template ids. If uncertain, suggestedTemplateId MUST be null.
- Classify each announcement into one category: general, events, special, giving, welcome, theme, closing.
- Provide a confidence score from 0 to 1 reflecting how certain you are about the extracted fields and mapping/template suggestions.
- Attach reviewReasons (an array, possibly empty) using ONLY these values when applicable: "unknown_announcement" (no known mapping fits), "ambiguous_date" (date/time unclear or conflicting), "template_uncertain" (unsure which template fits), "low_confidence" (general uncertainty), "truncated_text" (source text appears cut off or malformed).
- Roster/schedule lines (who is preaching, leading worship, on door duty, etc.) are NOT announcements — do not turn them into announcement entries. If a section contains only roster information, return it with an empty announcements array.
- Detect the overall documentLanguage: "en", "fr", or "mixed".
- Do NOT design slides, choose colors, change typography, invent church facts, silently rewrite unclear text, or automatically translate content.

Return ONLY the structured JSON matching the provided schema — no commentary.`;

function buildUserPrompt(input: ParseRunSheetInput): string {
  const mappingsBlock = input.mappings.length
    ? input.mappings
        .map(
          (m) =>
            `- canonicalKey: "${m.canonicalKey}" | canonicalName: "${m.canonicalName}" | aliases: ${
              m.aliases.length ? m.aliases.map((a) => `"${a}"`).join(", ") : "(none)"
            }`,
        )
        .join("\n")
    : "(no known recurring-announcement mappings are configured yet)";

  const templatesBlock = input.templates.length
    ? input.templates
        .map((t) => `- id: "${t.id}" | slug: "${t.slug}" | name: "${t.nameEn}" | category: "${t.category}"`)
        .join("\n")
    : "(no templates are configured yet)";

  return [
    `Service date hint (may be wrong — verify against the document text): ${input.serviceDateHint ?? "unknown"}`,
    `Document language hint: ${input.localeHint ?? "unknown"}`,
    "",
    "Known recurring announcement mappings (use ONLY these canonicalKey values; null if nothing matches):",
    mappingsBlock,
    "",
    "Available slide templates (use ONLY these ids for suggestedTemplateId; null if uncertain):",
    templatesBlock,
    "",
    "Run sheet text, extracted verbatim from the source document:",
    "---",
    input.text,
    "---",
  ].join("\n");
}

function buildRepairUserPrompt(originalUserPrompt: string, invalidOutputText: string, issues: string): string {
  return [
    originalUserPrompt,
    "",
    "Your previous response failed schema validation. Previous response:",
    invalidOutputText,
    "",
    "Validation errors:",
    issues,
    "",
    "Return corrected JSON that strictly matches the schema. Respond with ONLY the JSON object, no commentary.",
  ].join("\n");
}

type ValidateResult = { ok: true; data: ParsedRunSheet } | { ok: false; issues: string };

function tryValidate(outputText: string): ValidateResult {
  let json: unknown;
  try {
    json = JSON.parse(outputText);
  } catch (error) {
    return { ok: false, issues: `Invalid JSON: ${(error as Error).message}` };
  }

  const result = parsedRunSheetSchema.safeParse(json);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const issues = result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ");
  return { ok: false, issues };
}

/** Real network implementation: OpenAI Responses API with strict structured outputs, temperature 0. */
function createResponsesCallModel(): CallModel {
  return async ({ model, systemPrompt, userPrompt, jsonSchema, schemaName }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model,
      temperature: 0,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          schema: jsonSchema,
          strict: true,
        },
      },
    });
    return { outputText: response.output_text, raw: response };
  };
}

/**
 * Parses run-sheet text into a validated `ParsedRunSheet` using OpenAI
 * structured outputs. Retries once with a schema-repair prompt if the first
 * response fails Zod validation; throws {@link ParseValidationError} if the
 * retry also fails.
 */
export async function parseRunSheetText(
  input: ParseRunSheetInput,
  deps: { callModel?: CallModel } = {},
): Promise<ParseRunSheetResult> {
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1";
  const callModel = deps.callModel ?? createResponsesCallModel();
  const jsonSchema = parsedRunSheetJsonSchema();
  const systemPrompt = SYSTEM_PROMPT;
  const userPrompt = buildUserPrompt(input);

  const first = await callModel({ model, systemPrompt, userPrompt, jsonSchema, schemaName: SCHEMA_NAME });
  const firstResult = tryValidate(first.outputText);
  if (firstResult.ok) {
    return { parsed: firstResult.data, raw: first.raw, model };
  }

  const repairPrompt = buildRepairUserPrompt(userPrompt, first.outputText, firstResult.issues);
  const second = await callModel({
    model,
    systemPrompt,
    userPrompt: repairPrompt,
    jsonSchema,
    schemaName: SCHEMA_NAME,
  });
  const secondResult = tryValidate(second.outputText);
  if (secondResult.ok) {
    return { parsed: secondResult.data, raw: second.raw, model };
  }

  throw new ParseValidationError(
    `OpenAI structured output failed schema validation after one repair attempt: ${secondResult.issues}`,
    second.raw,
  );
}
