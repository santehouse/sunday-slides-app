/**
 * Text normalization and fuzzy-matching primitives shared by the announcement
 * mapper (`src/lib/mappings/matcher.ts`) and the run-sheet merge planner.
 * Pure, no I/O.
 */

const DIACRITICS = /[\u0300-\u036f]/g;

/**
 * Lowercases, strips accents (NFD decomposition), strips punctuation, and
 * collapses whitespace. Used to compare headlines/aliases in an
 * accent- and case-insensitive way.
 */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Dice coefficient (bigram overlap) similarity between two strings, in the
 * range [0, 1]. Case/accent sensitive — normalize inputs first (e.g. with
 * `normalizeText`) for fuzzy headline/alias comparisons.
 */
export function similarity(a: string, b: string): number {
  if (a === b) {
    return 1;
  }
  if (a.length < 2 || b.length < 2) {
    return 0;
  }

  const bigramCounts = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bigram = a.substring(i, i + 2);
    bigramCounts.set(bigram, (bigramCounts.get(bigram) ?? 0) + 1);
  }

  let matches = 0;
  let totalB = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bigram = b.substring(i, i + 2);
    totalB++;
    const remaining = bigramCounts.get(bigram) ?? 0;
    if (remaining > 0) {
      bigramCounts.set(bigram, remaining - 1);
      matches++;
    }
  }

  const totalA = a.length - 1;
  return (2 * matches) / (totalA + totalB);
}
