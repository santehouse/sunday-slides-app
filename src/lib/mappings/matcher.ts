/**
 * Announcement → mapping matcher (section 18 of BUILD_HANDOFF.md). Decides
 * which recurring-announcement mapping (and therefore template) a parsed
 * announcement belongs to. Pure, no I/O.
 */

import type { AnnouncementMapping } from "@/lib/domain/types";
import { normalizeText, similarity } from "@/lib/engines/textNormalize";

/** Similarity threshold (Dice coefficient) above which a headline/alias pair counts as a fuzzy match. */
export const FUZZY_MATCH_THRESHOLD = 0.82;

export interface MatchAnnouncementInput {
  headline: string;
  sourceText: string;
  /** AI-suggested canonical key, if any (must come from the provided mapping list, or be null). */
  canonicalKey?: string | null;
}

export type MatchMethod = "exact" | "canonical" | "fuzzy";

export interface MatchResult {
  mapping: AnnouncementMapping;
  confidence: number;
  /** The alias/canonical-name text that produced the match, or `null` for a canonicalKey match. */
  matchedAlias: string | null;
  method: MatchMethod;
}

interface Candidate {
  mapping: AnnouncementMapping;
  text: string;
}

function candidatesFor(mapping: AnnouncementMapping): Candidate[] {
  const aliasCandidates = mapping.aliases.map((alias) => ({ mapping, text: alias.alias }));
  return [...aliasCandidates, { mapping, text: mapping.canonicalName }];
}

function firstLine(text: string): string {
  return text.split(/\r?\n/, 1)[0] ?? "";
}

/**
 * Matches a parsed announcement against the configured announcement
 * mappings. Only `active` mappings are considered. Priority order:
 *
 * 1. Exact normalized match of the headline (or the source text's first
 *    line) against an alias or the mapping's canonical name → confidence 1.0.
 * 2. The AI-suggested `canonicalKey` equals a mapping's `canonicalKey` →
 *    confidence 0.95.
 * 3. Fuzzy match: Dice similarity ≥ {@link FUZZY_MATCH_THRESHOLD} between the
 *    headline and an alias/canonical name, OR the alias appears verbatim
 *    inside the source text's first line → confidence = the similarity score.
 *
 * Returns `null` when nothing clears the fuzzy threshold and no exact/
 * canonical match exists.
 */
export function matchAnnouncement(
  announcement: MatchAnnouncementInput,
  mappings: AnnouncementMapping[],
): MatchResult | null {
  const activeMappings = mappings.filter((mapping) => mapping.active);
  const normalizedHeadline = normalizeText(announcement.headline);
  const normalizedSourceFirstLine = normalizeText(firstLine(announcement.sourceText));

  // 1. Exact match.
  for (const mapping of activeMappings) {
    for (const candidate of candidatesFor(mapping)) {
      const normalizedCandidate = normalizeText(candidate.text);
      if (normalizedCandidate === "") continue;
      if (normalizedCandidate === normalizedHeadline || normalizedCandidate === normalizedSourceFirstLine) {
        return { mapping, confidence: 1, matchedAlias: candidate.text, method: "exact" };
      }
    }
  }

  // 2. Canonical key match (AI-suggested).
  if (announcement.canonicalKey) {
    const byCanonicalKey = activeMappings.find((mapping) => mapping.canonicalKey === announcement.canonicalKey);
    if (byCanonicalKey) {
      return { mapping: byCanonicalKey, confidence: 0.95, matchedAlias: null, method: "canonical" };
    }
  }

  // 3. Fuzzy match — best score wins.
  let best: MatchResult | null = null;
  for (const mapping of activeMappings) {
    for (const candidate of candidatesFor(mapping)) {
      const normalizedCandidate = normalizeText(candidate.text);
      if (normalizedCandidate === "") continue;

      const score = similarity(normalizedHeadline, normalizedCandidate);
      const containedInSource =
        normalizedSourceFirstLine.length > 0 && normalizedSourceFirstLine.includes(normalizedCandidate);

      if (score >= FUZZY_MATCH_THRESHOLD || containedInSource) {
        if (!best || score > best.confidence) {
          best = { mapping, confidence: score, matchedAlias: candidate.text, method: "fuzzy" };
        }
      }
    }
  }

  return best;
}
