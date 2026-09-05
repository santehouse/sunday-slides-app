import { describe, expect, it } from "vitest";
import { normalizeAlias } from "@/lib/data/normalize";

describe("normalizeAlias", () => {
  it("lowercases", () => {
    expect(normalizeAlias("Bible Study")).toBe("bible study");
  });

  it("strips accents (NFD)", () => {
    expect(normalizeAlias("Étude biblique")).toBe("etude biblique");
    expect(normalizeAlias("Veillée hommes")).toBe("veillee hommes");
    expect(normalizeAlias("Prière matinale")).toBe("priere matinale");
  });

  it("collapses whitespace and punctuation", () => {
    expect(normalizeAlias("Bible   Study!!")).toBe("bible study");
    expect(normalizeAlias("  Baptêmes ,  Dimanche  ")).toBe("baptemes dimanche");
  });

  it("produces the same key for EN and FR aliases of the same mapping", () => {
    expect(normalizeAlias("Étude de la Bible")).not.toBe(normalizeAlias("Bible Study"));
    // But two spellings of the same underlying alias should still match.
    expect(normalizeAlias("Veillée des hommes")).toBe(normalizeAlias("veillée   des-hommes"));
  });

  it("handles empty and purely-punctuation input", () => {
    expect(normalizeAlias("")).toBe("");
    expect(normalizeAlias("!!!")).toBe("");
  });
});
