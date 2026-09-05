import { describe, expect, it } from "vitest";
import { orderSlides, planStructuralSlides } from "@/lib/engines/structuralInsert";
import type { DefaultStructuralSlide, Slide } from "@/lib/domain/types";

function makeDefault(overrides: Partial<DefaultStructuralSlide> & { id: string }): DefaultStructuralSlide {
  return {
    templateId: "tmpl-structural",
    nameEn: overrides.id,
    nameFr: overrides.id,
    insertionRule: "always",
    defaultSortZone: "opening",
    sortOrder: 0,
    enabled: true,
    removableBySundayTeam: false,
    includeInVideoDefault: true,
    defaultContent: {},
    ...overrides,
  };
}

function makeSlide(overrides: Partial<Slide> & { id: string }): Slide {
  return {
    sundayId: "sunday-1",
    templateId: "tmpl-x",
    headline: "Headline",
    content: {},
    assetId: null,
    backgroundMode: "color",
    approvedColorId: null,
    sortOrder: 0,
    includeInVideo: true,
    status: "ready",
    isStructural: false,
    structuralDefaultId: null,
    parserConfidence: null,
    mappingId: null,
    sourceAnnouncement: null,
    manuallyEdited: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("planStructuralSlides", () => {
  it("inserts 'always' and 'default' rule slides that are missing from the deck", () => {
    const defaults = [
      makeDefault({ id: "welcome", insertionRule: "always", defaultSortZone: "opening" }),
      makeDefault({ id: "theme", insertionRule: "default", defaultSortZone: "opening" }),
    ];
    const { toInsert, skipped } = planStructuralSlides(defaults, []);
    expect(toInsert.map((entry) => entry.default.id)).toEqual(["welcome", "theme"]);
    expect(skipped).toEqual([]);
  });

  it("never auto-inserts a 'manual' rule default", () => {
    const defaults = [makeDefault({ id: "manual-only", insertionRule: "manual" })];
    const { toInsert, skipped } = planStructuralSlides(defaults, []);
    expect(toInsert).toEqual([]);
    expect(skipped).toEqual(["manual-only"]);
  });

  it("does not duplicate a structural slide already present (matched by structuralDefaultId)", () => {
    const defaults = [makeDefault({ id: "welcome", insertionRule: "always" })];
    const existing = [makeSlide({ id: "s1", isStructural: true, structuralDefaultId: "welcome" })];
    const { toInsert, skipped } = planStructuralSlides(defaults, existing);
    expect(toInsert).toEqual([]);
    expect(skipped).toEqual(["welcome"]);
  });

  it("skips disabled defaults", () => {
    const defaults = [makeDefault({ id: "disabled-one", enabled: false })];
    const { toInsert, skipped } = planStructuralSlides(defaults, []);
    expect(toInsert).toEqual([]);
    expect(skipped).toEqual(["disabled-one"]);
  });

  it("carries the default's configured zone", () => {
    const defaults = [makeDefault({ id: "rendez-vous", defaultSortZone: "before_announcements" })];
    const { toInsert } = planStructuralSlides(defaults, []);
    expect(toInsert[0].zone).toBe("before_announcements");
  });
});

describe("orderSlides", () => {
  it("places zones in fixed order: opening → before_announcements → announcements → after_announcements → closing", () => {
    const announcements = ["announcement-1", "announcement-2"];
    const structural = [
      { zone: "closing" as const, sortOrder: 0, label: "see-you-next-week" },
      { zone: "opening" as const, sortOrder: 0, label: "welcome" },
      { zone: "before_announcements" as const, sortOrder: 0, label: "rendez-vous" },
      { zone: "opening" as const, sortOrder: 1, label: "theme" },
    ];
    const ordered = orderSlides(announcements, structural);
    const labels = ordered.map((entry) => (typeof entry === "string" ? entry : entry.label));
    expect(labels).toEqual([
      "welcome",
      "theme",
      "rendez-vous",
      "announcement-1",
      "announcement-2",
      "see-you-next-week",
    ]);
  });

  it("sorts multiple structural slides within the same zone by sortOrder", () => {
    const structural = [
      { zone: "opening" as const, sortOrder: 2, label: "third" },
      { zone: "opening" as const, sortOrder: 0, label: "first" },
      { zone: "opening" as const, sortOrder: 1, label: "second" },
    ];
    const ordered = orderSlides([], structural);
    expect(ordered.map((entry) => entry.label)).toEqual(["first", "second", "third"]);
  });

  it("preserves announcement order and handles an empty structural list", () => {
    const ordered = orderSlides(["a", "b", "c"], []);
    expect(ordered).toEqual(["a", "b", "c"]);
  });

  it("handles zones with no entries gracefully", () => {
    const structural = [{ zone: "opening" as const, sortOrder: 0, label: "welcome" }];
    const ordered = orderSlides(["announcement"], structural);
    expect(ordered.map((entry) => (typeof entry === "string" ? entry : entry.label))).toEqual([
      "welcome",
      "announcement",
    ]);
  });
});
