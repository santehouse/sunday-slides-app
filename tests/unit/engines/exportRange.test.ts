import { describe, expect, it } from "vitest";
import { formatSlideRange, parseSlideRange } from "@/lib/engines/exportRange";

describe("parseSlideRange", () => {
  const max = 8;

  it.each([
    ["1-7", [1, 2, 3, 4, 5, 6, 7]],
    ["1-4,6-7", [1, 2, 3, 4, 6, 7]],
    ["1,3,5-8", [1, 3, 5, 6, 7, 8]],
    [" 1 , 3 , 5-8 ", [1, 3, 5, 6, 7, 8]],
    ["1–4,6–7", [1, 2, 3, 4, 6, 7]], // en-dash range separator
    ["3,1,2", [1, 2, 3]], // sorts ascending
    ["1,1,2,2", [1, 2]], // dedupes
  ])("parses %s", (input, expected) => {
    const result = parseSlideRange(input, max);
    expect(result).toEqual({ ok: true, numbers: expected });
  });

  it("returns empty for blank input", () => {
    expect(parseSlideRange("", max)).toEqual({ ok: false, error: "empty" });
    expect(parseSlideRange("   ", max)).toEqual({ ok: false, error: "empty" });
  });

  it.each(["0", "1,0", "9", "1-9", "1,3,5-9"])("returns out_of_bounds for %s (max=8)", (input) => {
    expect(parseSlideRange(input, max)).toEqual({ ok: false, error: "out_of_bounds" });
  });

  it.each([
    "abc",
    "1,,2",
    "1,",
    ",1",
    "4-2",
    "1--2",
    "1-2-3",
    "1, a",
    "1.5",
    "-3",
  ])("returns invalid for malformed input %s", (input) => {
    expect(parseSlideRange(input, max)).toEqual({ ok: false, error: "invalid" });
  });

  it("rejects a pathologically wide range", () => {
    expect(parseSlideRange("1-999999", 1_000_000)).toEqual({ ok: false, error: "invalid" });
  });
});

describe("formatSlideRange", () => {
  it("collapses consecutive runs into ranges", () => {
    expect(formatSlideRange([1, 2, 3, 4, 6, 7])).toBe("1-4, 6-7");
  });

  it("formats a single contiguous range", () => {
    expect(formatSlideRange([1, 2, 3, 4, 5, 6, 7])).toBe("1-7");
  });

  it("formats singletons individually", () => {
    expect(formatSlideRange([1, 3, 5, 6, 7, 8])).toBe("1, 3, 5-8");
  });

  it("sorts and dedupes before formatting", () => {
    expect(formatSlideRange([3, 1, 2, 2])).toBe("1-3");
  });

  it("returns an empty string for no slides", () => {
    expect(formatSlideRange([])).toBe("");
  });

  it("formats a single slide", () => {
    expect(formatSlideRange([5])).toBe("5");
  });
});

describe("round-trip property: parse(format(x)) === x", () => {
  // Deterministic PRNG (mulberry32) so this is reproducible without adding a
  // property-testing dependency.
  function mulberry32(seed: number) {
    let a = seed;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it("holds for 200 random subsets of [1, 50]", () => {
    const rand = mulberry32(42);
    const max = 50;
    for (let trial = 0; trial < 200; trial++) {
      const size = Math.floor(rand() * 15) + 1;
      const numbers = new Set<number>();
      for (let i = 0; i < size; i++) {
        numbers.add(Math.floor(rand() * max) + 1);
      }
      const sorted = Array.from(numbers).sort((a, b) => a - b);
      const formatted = formatSlideRange(sorted);
      const parsed = parseSlideRange(formatted, max);
      expect(parsed).toEqual({ ok: true, numbers: sorted });
    }
  });
});
