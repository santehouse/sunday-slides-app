/**
 * Normalizes alias/announcement source text for matching:
 * lowercase, strip diacritics (NFD decomposition), collapse
 * whitespace/punctuation to single spaces, trim.
 *
 * "Étude Biblique"  -> "etude biblique"
 * "Bible  Study!"   -> "bible study"
 */
const COMBINING_DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

export function normalizeAlias(text: string): string {
  return text
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
