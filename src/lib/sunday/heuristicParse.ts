/**
 * Deterministic, offline fallback run-sheet parser (sections 15-17 of
 * BUILD_HANDOFF.md). Used by `ingestRunSheet` (see `./intake.ts`) instead of
 * the real OpenAI parser whenever `hasOpenAI()` is false — mock mode,
 * missing API key, or a unit test. Same call signature as
 * `parseRunSheetText` (`@/lib/openai/client`) so `processRunSheet` can take
 * either as its injectable `parse` dependency.
 *
 * This exists so the product stays USABLE offline, not to rival the real
 * OpenAI parser — it never sees the document's actual meaning, only its
 * shape. Real mapping/template resolution still happens for real afterwards
 * in `src/lib/mappings/matcher.ts` + `src/lib/run-sheets/plan.ts` against the
 * full `AnnouncementMapping[]` list; this module's own best-effort alias
 * matching (against the trimmed `MappingContext[]` OpenAI also gets) only
 * feeds this parser's own confidence/reviewReasons.
 *
 * Algorithm:
 *  1. Find numbered section headings ("1.-", "2.-", ...), each on its own
 *     line, and split the extracted text into sections on them. Content
 *     before the first heading (roster lines, the service-date line) is not
 *     part of any section and is never turned into an announcement.
 *  2. Within a section's body, every blank-line-separated block of text is
 *     treated as one announcement (a block with several single-newline-
 *     separated lines, e.g. a tight list, is still one announcement with
 *     several lines).
 *  3. A block's headline is whichever of its lines exactly matches (accent-
 *     and case-insensitive) a known mapping alias/canonical name; failing
 *     that, its shortest line. Every other line becomes line1, then line2
 *     (extras beyond that are dropped — templates only expose two body
 *     lines).
 *  4. confidence is 0.6 and reviewReasons is `["heuristic_parse"]`, unless a
 *     mapping matched exactly, in which case confidence is 0.95 and
 *     reviewReasons is empty.
 *  5. A generic safety net drops "roster" blocks anywhere (every line reads
 *     as `ROLE / NAME`) so a schedule table never becomes an announcement.
 */
import type { ParsedAnnouncement, ParsedRunSheet, ParsedSection, TemplateCategory } from "@/lib/domain/types";
import type { MappingContext, ParseRunSheetInput, ParseRunSheetResult } from "@/lib/openai/client";
import { normalizeText } from "@/lib/engines/textNormalize";

export const HEURISTIC_MODEL_NAME = "heuristic-v1";

const HEADING_RE = /^#?\s*(\d+)\.-\s*(.+)$/;
const BULLET_RE = /^[-•*]\s*/;

interface RawSection {
  title: string;
  body: string;
}

/** Splits `text` into numbered sections. Text before the first heading is discarded. */
function splitIntoSections(text: string): RawSection[] {
  const lines = text.split("\n");
  const headingIndexes: { lineIndex: number; title: string }[] = [];

  lines.forEach((line, lineIndex) => {
    const match = HEADING_RE.exec(line.trim());
    if (match) headingIndexes.push({ lineIndex, title: match[2].trim() });
  });

  if (headingIndexes.length === 0) {
    return text.trim() === "" ? [] : [{ title: "", body: text }];
  }

  const sections: RawSection[] = [];
  for (let i = 0; i < headingIndexes.length; i++) {
    const start = headingIndexes[i].lineIndex + 1;
    const end = i + 1 < headingIndexes.length ? headingIndexes[i + 1].lineIndex : lines.length;
    sections.push({ title: headingIndexes[i].title, body: lines.slice(start, end).join("\n") });
  }
  return sections;
}

/** Splits a section body into blank-line-separated blocks, each an array of trimmed, non-empty lines. */
function splitIntoBlocks(body: string): string[][] {
  return body
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== ""),
    )
    .filter((lines) => lines.length > 0);
}

/** A schedule/roster block: every line looks like "ROLE / NAME" — never an announcement. */
function isRosterBlock(lines: string[]): boolean {
  if (lines.length < 2) return false;
  return lines.every((line) => / \/ /.test(line) && !/\d{2}h\d{2}/i.test(line));
}

interface MappingMatch {
  matchedText: string;
  canonicalKey: string;
}

/** Best-effort exact (normalized) match of one line against the provided mapping context. */
function findMappingMatch(line: string, mappings: MappingContext[]): MappingMatch | null {
  const normalizedLine = normalizeText(line);
  if (normalizedLine === "") return null;
  for (const mapping of mappings) {
    const candidates = [mapping.canonicalName, ...mapping.aliases];
    for (const candidate of candidates) {
      if (normalizeText(candidate) === normalizedLine) {
        return { matchedText: candidate, canonicalKey: mapping.canonicalKey };
      }
    }
  }
  return null;
}

/** Picks the shortest line (by trimmed character length) as a headline fallback. */
function shortestLine(lines: string[]): string {
  return lines.reduce((shortest, line) => (line.length < shortest.length ? line : shortest), lines[0]);
}

const CATEGORY_KEYWORDS: [RegExp, TemplateCategory][] = [
  [/dime|offrande|giving|tithe/i, "giving"],
  [/bienvenue|welcome/i, "welcome"],
  [/theme|thème/i, "theme"],
  [/semaine prochaine|next week|au revoir|closing/i, "closing"],
  [/conference|conférence|special|spécial/i, "special"],
  [/bapteme|baptême|baptism|veillee|veillée|priere|prière|classe|event|événement|evenement/i, "events"],
];

function guessCategory(sectionTitle: string, headline: string): TemplateCategory {
  const haystack = `${sectionTitle} ${headline}`;
  for (const [pattern, category] of CATEGORY_KEYWORDS) {
    if (pattern.test(haystack)) return category;
  }
  return "general";
}

const FRENCH_HINTS = /[éèêëàâîïôùûçœ]|(\bde\b|\bdes\b|\ble\b|\bla\b|\bles\b|\bet\b|\bdimanche\b|\bmercredi\b)/i;
const ENGLISH_HINTS = /\b(the|and|for|with|sunday|wednesday|welcome)\b/i;

/** Crude accent/keyword heuristic — good enough to pick a sensible default when there's no real NLP available. */
function guessDocumentLanguage(text: string): "en" | "fr" | "mixed" {
  const frenchHits = (text.match(new RegExp(FRENCH_HINTS, "gi")) ?? []).length;
  const englishHits = (text.match(new RegExp(ENGLISH_HINTS, "gi")) ?? []).length;
  if (frenchHits === 0 && englishHits === 0) return "mixed";
  if (frenchHits > 0 && englishHits > 0 && Math.min(frenchHits, englishHits) / Math.max(frenchHits, englishHits) > 0.4) {
    return "mixed";
  }
  return frenchHits >= englishHits ? "fr" : "en";
}

/** `DD-MM-YYYY` or ISO `YYYY-MM-DD` near the top of the document — the run sheet's own date line. */
function extractServiceDate(text: string, fallback: string | null): string | null {
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const short = text.match(/\b(\d{2})-(\d{2})-(\d{4})\b/);
  if (short) return `${short[3]}-${short[2]}-${short[1]}`;
  return fallback;
}

function buildAnnouncement(
  sourceOrder: number,
  sectionTitle: string,
  lines: string[],
  mappings: MappingContext[],
): ParsedAnnouncement {
  const stripped = lines.map((line) => line.replace(BULLET_RE, "").trim()).filter((line) => line !== "");
  const sourceText = lines.join("\n");

  let headline = shortestLine(stripped);
  let match: MappingMatch | null = null;
  for (const line of stripped) {
    const found = findMappingMatch(line, mappings);
    if (found) {
      match = found;
      headline = line;
      break;
    }
  }

  const remaining = stripped.filter((line) => line !== headline);

  return {
    sourceOrder,
    sourceText,
    canonicalKey: match?.canonicalKey ?? null,
    category: guessCategory(sectionTitle, headline),
    headline,
    line1: remaining[0] ?? null,
    line2: remaining[1] ?? null,
    suggestedMappingId: null,
    suggestedTemplateId: null,
    confidence: match ? 0.95 : 0.6,
    reviewReasons: match ? [] : ["heuristic_parse"],
  };
}

/**
 * The heuristic equivalent of `parseRunSheetText` — same input/output shape,
 * no network, fully deterministic. Pass this as `processRunSheet`'s `parse`
 * dependency whenever `hasOpenAI()` is false.
 */
export async function heuristicParseRunSheetText(input: ParseRunSheetInput): Promise<ParseRunSheetResult> {
  const rawSections = splitIntoSections(input.text);

  let sourceOrder = 0;
  const sections: ParsedSection[] = rawSections.map((rawSection) => {
    const blocks = splitIntoBlocks(rawSection.body).filter((lines) => !isRosterBlock(lines));
    const announcements = blocks.map((lines) => {
      sourceOrder += 1;
      return buildAnnouncement(sourceOrder, rawSection.title, lines, input.mappings);
    });
    return { title: rawSection.title, announcements };
  });

  const parsed: ParsedRunSheet = {
    serviceDate: extractServiceDate(input.text, input.serviceDateHint ?? null),
    documentLanguage: input.localeHint ?? guessDocumentLanguage(input.text),
    sections,
  };

  return {
    parsed,
    raw: { parser: "heuristic", model: HEURISTIC_MODEL_NAME },
    model: HEURISTIC_MODEL_NAME,
  };
}
