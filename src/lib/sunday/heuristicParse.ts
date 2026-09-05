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
 * feeds this parser's own confidence/reviewReasons/canonicalKey guess.
 *
 * Algorithm (tuned against the real fixture — see `scripts/parse-fixture.ts`):
 *  1. Find numbered section headings ("1.-", "2.-", ...), each on its own
 *     line, and split the extracted text into sections on them. Content
 *     before the first heading (the service-date line, roster lines like
 *     "PRIÈRE / GERARD M") is not part of any section and never becomes an
 *     announcement.
 *  2. Per section, decide how it's written:
 *     - If the section TITLE itself exactly matches a known mapping alias/
 *       canonical name (e.g. "DÎMES ET OFFRANDES"), or the section has no
 *       bullet ("- ...") lines at all (e.g. "CONFÉRENCE EAJC" — a single
 *       paragraph), the WHOLE section is one announcement: headline = the
 *       section title, line1 = its first content line, line2 = every other
 *       line joined with " · " (truncated to ~80 chars).
 *     - Otherwise, each line starting with "- " begins a new announcement;
 *       every following non-bullet line (up to the next bullet or the
 *       section's end) belongs to it. Within that group: headline is
 *       whichever line matches a mapping alias/canonical name, else the
 *       first line that isn't date/time-like (starts with a weekday, or
 *       contains "HHhMM" or a month name). line1 is the first date/time-
 *       like remaining line (or, failing that, just the next remaining
 *       line); line2 is whatever's left after that.
 *  3. confidence is 0.95 with empty reviewReasons when a mapping matched
 *     exactly; otherwise 0.6 with `["heuristic_parse", "unknown_announcement"]`.
 *     Real mapping resolution (including fuzzy matching) still happens
 *     downstream regardless of this parser's own canonicalKey guess.
 */
import type { ParsedAnnouncement, ParsedRunSheet, ParsedSection, TemplateCategory } from "@/lib/domain/types";
import type { MappingContext, ParseRunSheetInput, ParseRunSheetResult } from "@/lib/openai/client";
import { normalizeText } from "@/lib/engines/textNormalize";

export const HEURISTIC_MODEL_NAME = "heuristic-v1";

const HEADING_RE = /^#?\s*(\d+)\.-\s*(.+)$/;
const BULLET_RE = /^[-•*]\s*/;

/** Section-level line2 (rule 1) is a "· "-joined summary, not a real second content line. */
const SECTION_LINE2_MAX_LENGTH = 80;

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

/** Non-empty, trimmed lines of a section body, in order — blank lines carry no structure here. */
function splitIntoLines(body: string): string[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/** Groups a section's lines by bullet: each "- " line starts a group, following non-bullet lines join it. */
function splitIntoBulletGroups(lines: string[]): string[][] {
  const groups: string[][] = [];
  for (const line of lines) {
    if (BULLET_RE.test(line)) {
      groups.push([line.replace(BULLET_RE, "").trim()]);
    } else if (groups.length > 0) {
      groups[groups.length - 1].push(line);
    }
    // Content before the first bullet in a bullet-structured section is discarded —
    // "a line starting with '- ' begins a new announcement".
  }
  return groups.filter((group) => group.length > 0);
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

// --- Date/time-like line detection -----------------------------------------------------------

const WEEKDAYS = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const MONTHS = [
  "janvier",
  "fevrier",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "aout",
  "septembre",
  "octobre",
  "novembre",
  "decembre",
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const TIME_RE = /\d{1,2}h\d{2}/;

/** A line "starts with a weekday", contains an "HHhMM" time, or names a month — i.e. reads as scheduling info. */
function isDateTimeLike(line: string): boolean {
  const normalized = normalizeText(line);
  if (WEEKDAYS.some((day) => normalized === day || normalized.startsWith(`${day} `))) return true;
  if (TIME_RE.test(normalized)) return true;
  if (MONTHS.some((month) => normalized.includes(month))) return true;
  return false;
}

// --- Category guess ----------------------------------------------------------------------------

const CATEGORY_KEYWORDS: [RegExp, TemplateCategory][] = [
  [/\bdimes?\b|\boffrandes?\b|giving|tithe/, "giving"],
  [/bienvenue|welcome/, "welcome"],
  [/\btheme\b/, "theme"],
  [/semaine prochaine|next week|au revoir|closing/, "closing"],
  [/conference|special/, "special"],
  [/baptem|baptism|veillee|priere|classe|event|evenement/, "events"],
];

function guessCategory(sectionTitle: string, headline: string): TemplateCategory {
  const haystack = normalizeText(`${sectionTitle} ${headline}`);
  for (const [pattern, category] of CATEGORY_KEYWORDS) {
    if (pattern.test(haystack)) return category;
  }
  return "general";
}

// --- Document-level guesses ----------------------------------------------------------------------

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

// --- Announcement builders -----------------------------------------------------------------------

/** Rule 1: the whole section is one announcement (its title matches a mapping, or it has no bullets). */
function buildSectionLevelAnnouncement(
  sourceOrder: number,
  sectionTitle: string,
  lines: string[],
  match: MappingMatch | null,
): ParsedAnnouncement {
  const contentLines = lines.map((line) => line.replace(BULLET_RE, "").trim()).filter((line) => line !== "");
  const line1 = contentLines[0] ?? null;
  const rest = contentLines.slice(1);
  let line2: string | null = rest.length > 0 ? rest.join(" · ") : null;
  if (line2 && line2.length > SECTION_LINE2_MAX_LENGTH) {
    line2 = `${line2.slice(0, SECTION_LINE2_MAX_LENGTH)}…`;
  }

  return {
    sourceOrder,
    sourceText: lines.join("\n"),
    canonicalKey: match?.canonicalKey ?? null,
    category: guessCategory(sectionTitle, sectionTitle),
    headline: sectionTitle,
    line1,
    line2,
    suggestedMappingId: null,
    suggestedTemplateId: null,
    confidence: match ? 0.95 : 0.6,
    reviewReasons: match ? [] : ["heuristic_parse", "unknown_announcement"],
  };
}

/** Rule 2: one bullet ("- ...") plus its following non-bullet lines is one announcement. */
function buildBulletAnnouncement(
  sourceOrder: number,
  sectionTitle: string,
  groupLines: string[],
  mappings: MappingContext[],
): ParsedAnnouncement {
  let headline: string | null = null;
  let match: MappingMatch | null = null;
  for (const line of groupLines) {
    const found = findMappingMatch(line, mappings);
    if (found) {
      match = found;
      headline = line;
      break;
    }
  }
  if (!headline) {
    headline = groupLines.find((line) => !isDateTimeLike(line)) ?? groupLines[0];
  }

  const remaining = groupLines.filter((line) => line !== headline);

  let line1: string | null = null;
  const dateIndex = remaining.findIndex((line) => isDateTimeLike(line));
  if (dateIndex !== -1) {
    line1 = remaining[dateIndex];
    remaining.splice(dateIndex, 1);
  } else if (remaining.length > 0) {
    line1 = remaining.shift() ?? null;
  }
  const line2 = remaining.length > 0 ? remaining[0] : null;

  return {
    sourceOrder,
    sourceText: groupLines.join("\n"),
    canonicalKey: match?.canonicalKey ?? null,
    category: guessCategory(sectionTitle, headline),
    headline,
    line1,
    line2,
    suggestedMappingId: null,
    suggestedTemplateId: null,
    confidence: match ? 0.95 : 0.6,
    reviewReasons: match ? [] : ["heuristic_parse", "unknown_announcement"],
  };
}

/** Processes one section into 0+ announcements, per the rule-1/rule-2 split above. */
function processSection(
  sourceOrderStart: number,
  section: RawSection,
  mappings: MappingContext[],
): { announcements: ParsedAnnouncement[]; nextOrder: number } {
  const lines = splitIntoLines(section.body);
  if (lines.length === 0) {
    return { announcements: [], nextOrder: sourceOrderStart };
  }

  const titleMatch = findMappingMatch(section.title, mappings);
  const sectionHasBullets = lines.some((line) => BULLET_RE.test(line));

  if (titleMatch || !sectionHasBullets) {
    const announcement = buildSectionLevelAnnouncement(sourceOrderStart, section.title, lines, titleMatch);
    return { announcements: [announcement], nextOrder: sourceOrderStart + 1 };
  }

  let order = sourceOrderStart;
  const announcements = splitIntoBulletGroups(lines).map((group) =>
    buildBulletAnnouncement(order++, section.title, group, mappings),
  );
  return { announcements, nextOrder: order };
}

/**
 * The heuristic equivalent of `parseRunSheetText` — same input/output shape,
 * no network, fully deterministic. Pass this as `processRunSheet`'s `parse`
 * dependency whenever `hasOpenAI()` is false.
 */
export async function heuristicParseRunSheetText(input: ParseRunSheetInput): Promise<ParseRunSheetResult> {
  const rawSections = splitIntoSections(input.text);

  let sourceOrder = 1;
  const sections: ParsedSection[] = rawSections.map((rawSection) => {
    const { announcements, nextOrder } = processSection(sourceOrder, rawSection, input.mappings);
    sourceOrder = nextOrder;
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
