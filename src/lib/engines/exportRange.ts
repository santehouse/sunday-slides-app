/**
 * Parses and formats the "custom slide selection" range syntax used by the
 * export popover (section 8/9 of BUILD_HANDOFF.md): `1-7`, `1-4,6-7`,
 * `1,3,5-8`. Pure, no I/O.
 */

export type SlideRangeError = "invalid" | "out_of_bounds" | "empty";

export type SlideRangeResult = { ok: true; numbers: number[] } | { ok: false; error: SlideRangeError };

/** Guard against pathologically wide ranges (e.g. "1-999999999") expanding into huge arrays. */
const MAX_RANGE_SPAN = 20_000;

const SINGLE_TOKEN = /^(\d+)$/;
const RANGE_TOKEN = /^(\d+)\s*-\s*(\d+)$/;

/**
 * Parses a slide range string against a 1-based slide count `max`.
 *
 * - Accepts a regular hyphen or an en-dash (`–`) as the range separator.
 * - Whitespace around numbers, commas and dashes is ignored.
 * - Numbers are deduplicated and returned sorted ascending.
 */
export function parseSlideRange(input: string, max: number): SlideRangeResult {
  const trimmed = input.trim();
  if (trimmed === "") {
    return { ok: false, error: "empty" };
  }

  // En-dash is an accepted alternative range separator (e.g. "1–4").
  const normalized = trimmed.replace(/–/g, "-");

  const tokens = normalized.split(",");
  const numbers = new Set<number>();

  for (const rawToken of tokens) {
    const token = rawToken.trim();
    if (token === "") {
      // Empty segment: leading/trailing/double comma.
      return { ok: false, error: "invalid" };
    }

    const singleMatch = SINGLE_TOKEN.exec(token);
    if (singleMatch) {
      numbers.add(Number(singleMatch[1]));
      continue;
    }

    const rangeMatch = RANGE_TOKEN.exec(token);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (start > end) {
        return { ok: false, error: "invalid" };
      }
      if (end - start > MAX_RANGE_SPAN) {
        return { ok: false, error: "invalid" };
      }
      for (let n = start; n <= end; n++) {
        numbers.add(n);
      }
      continue;
    }

    // Letters, malformed range (e.g. "1--2", "a-3"), stray characters, etc.
    return { ok: false, error: "invalid" };
  }

  const sorted = Array.from(numbers).sort((a, b) => a - b);
  const outOfBounds = sorted.some((n) => n < 1 || n > max);
  if (outOfBounds) {
    return { ok: false, error: "out_of_bounds" };
  }

  return { ok: true, numbers: sorted };
}

/**
 * Formats a list of slide numbers into the compact range syntax, e.g.
 * `[1,2,3,4,6,7]` → `"1-4, 6-7"`. Deduplicates and sorts internally.
 */
export function formatSlideRange(numbers: number[]): string {
  const sorted = Array.from(new Set(numbers)).sort((a, b) => a - b);
  if (sorted.length === 0) {
    return "";
  }

  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    const current = sorted[i];
    if (current === prev + 1) {
      prev = current;
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    if (current !== undefined) {
      start = current;
      prev = current;
    }
  }

  return parts.join(", ");
}
