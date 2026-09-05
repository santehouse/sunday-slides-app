import { describe, expect, it } from "vitest";
import { normalizeText, similarity } from "@/lib/engines/textNormalize";

describe("normalizeText", () => {
  it("lowercases, strips accents, and strips punctuation", () => {
    expect(normalizeText("Étude Biblique!")).toBe("etude biblique");
    expect(normalizeText("Prière matinale des femmes")).toBe("priere matinale des femmes");
  });

  it("collapses whitespace", () => {
    expect(normalizeText("  Hello   World  ")).toBe("hello world");
    expect(normalizeText("Line1\n\nLine2\t\tLine3")).toBe("line1 line2 line3");
  });

  it("is idempotent", () => {
    const once = normalizeText("Café — Réunion des Hommes!");
    expect(normalizeText(once)).toBe(once);
  });
});

describe("similarity", () => {
  it("returns 1 for identical strings", () => {
    expect(similarity("hello world", "hello world")).toBe(1);
  });

  it("returns 0 for completely different short strings", () => {
    expect(similarity("a", "b")).toBe(0);
  });

  it("returns a high score for near-identical strings (typo tolerance)", () => {
    const a = normalizeText("Prière matinale des femmes");
    const b = normalizeText("Prière matinales des femmes"); // pluralization typo
    expect(similarity(a, b)).toBeGreaterThanOrEqual(0.82);
  });

  it("returns a low score for unrelated strings", () => {
    const a = normalizeText("Prière matinale des femmes");
    const b = normalizeText("Veillée des hommes");
    expect(similarity(a, b)).toBeLessThan(0.5);
  });

  it("is symmetric", () => {
    const a = "bonjour tout le monde";
    const b = "bonjour a tous";
    expect(similarity(a, b)).toBeCloseTo(similarity(b, a), 10);
  });

  it("is within [0, 1]", () => {
    expect(similarity("xyz", "abcdefg")).toBeGreaterThanOrEqual(0);
    expect(similarity("xyz", "abcdefg")).toBeLessThanOrEqual(1);
  });
});
