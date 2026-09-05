/**
 * Zod schema for `ParsedRunSheet` (section 17 of BUILD_HANDOFF.md), used to
 * validate OpenAI's structured output, plus a JSON Schema export shaped for
 * OpenAI's structured-outputs strict mode (every property required,
 * `additionalProperties: false` everywhere).
 */

import { z } from "zod";
import type { ParsedAnnouncement, ParsedRunSheet, ParsedSection, TemplateCategory } from "@/lib/domain/types";

export const TEMPLATE_CATEGORIES = [
  "general",
  "events",
  "special",
  "giving",
  "welcome",
  "theme",
  "closing",
] as const satisfies readonly TemplateCategory[];

export const templateCategorySchema = z.enum(TEMPLATE_CATEGORIES);

export const documentLanguageSchema = z.enum(["en", "fr", "mixed"]);

/** Machine-readable reasons the parser can attach to an announcement needing human review. */
export const REVIEW_REASONS = [
  "unknown_announcement",
  "ambiguous_date",
  "template_uncertain",
  "low_confidence",
  "truncated_text",
] as const;

export const parsedAnnouncementSchema = z
  .object({
    sourceOrder: z.number().int().min(0),
    sourceText: z.string(),
    canonicalKey: z.string().nullable(),
    category: templateCategorySchema,
    headline: z.string(),
    line1: z.string().nullable(),
    line2: z.string().nullable(),
    suggestedMappingId: z.string().nullable(),
    suggestedTemplateId: z.string().nullable(),
    confidence: z.number().min(0).max(1),
    reviewReasons: z.array(z.string()),
  })
  .strict() satisfies z.ZodType<ParsedAnnouncement>;

export const parsedSectionSchema = z
  .object({
    title: z.string(),
    announcements: z.array(parsedAnnouncementSchema),
  })
  .strict() satisfies z.ZodType<ParsedSection>;

export const parsedRunSheetSchema = z
  .object({
    serviceDate: z.string().nullable(),
    documentLanguage: documentLanguageSchema,
    sections: z.array(parsedSectionSchema),
  })
  .strict() satisfies z.ZodType<ParsedRunSheet>;

export type ParsedRunSheetInput = z.input<typeof parsedRunSheetSchema>;

/**
 * JSON Schema for OpenAI structured outputs (`text.format.type: "json_schema"`,
 * `strict: true`). zod v4's `toJSONSchema` already emits `additionalProperties:
 * false` and lists every field as required (this schema never uses
 * `.optional()`, only `.nullable()`, so that holds for every nested object).
 */
export function parsedRunSheetJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(parsedRunSheetSchema) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}
