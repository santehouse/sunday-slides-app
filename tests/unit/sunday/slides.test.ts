import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

process.env.CP_MOCK_DATA = "1";

const { resetMockStore } = await import("@/lib/data/mockDb");
const { getDb, normalizeAlias } = await import("@/lib/data");
const { ingestRunSheet, applyRunSheet } = await import("@/lib/sunday/intake");
const { createSlideFromTemplate, duplicateSlide, rememberMapping, removeSlide } = await import("@/lib/sunday/slides");

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const FIXTURE_PATH = resolve(__dirname, "../../fixtures/run-sheets/260906.docx");

function loadFixtureBytes(): Uint8Array {
  return new Uint8Array(readFileSync(FIXTURE_PATH));
}

beforeEach(() => {
  resetMockStore();
});

/** Applies the real fixture (replace mode) to a fresh Sunday and returns its slides. */
async function seedAppliedSunday(sundayDate: string) {
  const db = getDb();
  const runSheet = await ingestRunSheet({
    bytes: loadFixtureBytes(),
    filename: "260906.docx",
    mimeType: DOCX_MIME,
    sourceType: "manual",
    sundayDate,
  });
  const applied = await applyRunSheet(runSheet.id, "replace");
  const slides = await db.listSlidesForSunday(applied.sundayId);
  return { db, sundayId: applied.sundayId, slides };
}

describe("createSlideFromTemplate", () => {
  it("creates a blank slide at the end of the flow, invalid until required fields are filled", async () => {
    const db = getDb();
    const sunday = await db.getOrCreateSundayByDate("2026-11-08");
    const templates = await db.listTemplates({ status: "published" });
    const template = templates[0]!;

    const slide = await createSlideFromTemplate(sunday.id, template.id);

    expect(slide.sundayId).toBe(sunday.id);
    expect(slide.templateId).toBe(template.id);
    expect(slide.headline).toBe("");
    expect(slide.isStructural).toBe(false);
    expect(slide.manuallyEdited).toBe(true);
    expect(slide.sourceAnnouncement).toBeNull();
    if (template.fields.some((f) => f.required)) {
      expect(slide.status).toBe("invalid");
    } else {
      expect(slide.status).toBe("ready");
    }
  });
});

describe("duplicateSlide", () => {
  it("inserts a copy immediately after the original and renumbers the deck", async () => {
    const { db, sundayId, slides } = await seedAppliedSunday("2026-11-15");
    const original = slides[2]!;

    const copy = await duplicateSlide(original.id);

    expect(copy.headline).toBe(original.headline);
    expect(copy.isStructural).toBe(false);
    expect(copy.manuallyEdited).toBe(true);

    const after = await db.listSlidesForSunday(sundayId);
    const originalIndex = after.findIndex((s) => s.id === original.id);
    expect(after[originalIndex + 1]!.id).toBe(copy.id);
    after.forEach((slide, index) => expect(slide.sortOrder).toBe(index));
  });
});

describe("rememberMapping", () => {
  it("creates a reusable mapping + alias for an unmapped announcement and updates the slide", async () => {
    const { db, slides } = await seedAppliedSunday("2026-11-22");
    const unmapped = slides.find((s) => s.sourceAnnouncement !== null && s.mappingId === null);
    expect(unmapped).toBeDefined();

    const templates = await db.listTemplates({ status: "published" });
    const targetTemplate = templates.find((t) => t.id !== unmapped!.templateId)!;

    await rememberMapping(unmapped!.id, targetTemplate.id);

    const updated = await db.getSlide(unmapped!.id);
    expect(updated!.templateId).toBe(targetTemplate.id);
    expect(updated!.mappingId).not.toBeNull();

    const mapping = await db.getMapping(updated!.mappingId!);
    expect(mapping).not.toBeNull();
    expect(mapping!.templateId).toBe(targetTemplate.id);

    const normalizedHeadline = normalizeAlias(unmapped!.sourceAnnouncement!.headline);
    const hasAlias =
      normalizeAlias(mapping!.canonicalName) === normalizedHeadline ||
      mapping!.aliases.some((a) => normalizeAlias(a.alias) === normalizedHeadline);
    expect(hasAlias).toBe(true);
  });

  it("dismisses a matching mapping suggestion once remembered", async () => {
    const { db, slides } = await seedAppliedSunday("2026-11-29");
    const unmapped = slides.find((s) => s.sourceAnnouncement !== null && s.mappingId === null);
    expect(unmapped).toBeDefined();

    const normalizedHeadline = normalizeAlias(unmapped!.sourceAnnouncement!.headline);
    const suggestionsBefore = await db.listMappingSuggestions();
    expect(suggestionsBefore.some((s) => s.sourceTextNormalized === normalizedHeadline)).toBe(true);

    const templates = await db.listTemplates({ status: "published" });
    await rememberMapping(unmapped!.id, templates[0]!.id);

    const suggestionsAfter = await db.listMappingSuggestions();
    expect(suggestionsAfter.some((s) => s.sourceTextNormalized === normalizedHeadline)).toBe(false);
  });
});

describe("removeSlide", () => {
  it("refuses to remove an 'always' structural slide", async () => {
    const { db, slides } = await seedAppliedSunday("2026-12-06");
    const welcome = slides.find((s) => s.isStructural && s.headline === "BIENVENUE");
    expect(welcome).toBeDefined();

    const result = await removeSlide(welcome!.id);

    expect(result).toEqual({ ok: false, error: "not_removable" });
    expect(await db.getSlide(welcome!.id)).not.toBeNull();
  });

  it("allows removing a 'default' (removable) structural slide", async () => {
    const { db, sundayId, slides } = await seedAppliedSunday("2026-12-13");
    const rendezVous = slides.find((s) => s.headline === "RENDEZ-VOUS DE LA SEMAINE");
    expect(rendezVous).toBeDefined();

    const result = await removeSlide(rendezVous!.id);

    expect(result).toEqual({ ok: true });
    expect(await db.getSlide(rendezVous!.id)).toBeNull();

    const remaining = await db.listSlidesForSunday(sundayId);
    remaining.forEach((slide, index) => expect(slide.sortOrder).toBe(index));
  });

  it("removes a plain (non-structural) announcement slide", async () => {
    const { db, slides } = await seedAppliedSunday("2026-12-20");
    const announcement = slides.find((s) => !s.isStructural)!;

    const result = await removeSlide(announcement.id);

    expect(result).toEqual({ ok: true });
    expect(await db.getSlide(announcement.id)).toBeNull();
  });
});
