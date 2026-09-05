import { beforeEach, describe, expect, it } from "vitest";

process.env.CP_MOCK_DATA = "1";

const { resetMockStore } = await import("@/lib/data/mockDb");
const { getDb } = await import("@/lib/data");
const { checkDeckExportable } = await import("@/lib/sunday/exports");

beforeEach(() => {
  resetMockStore();
});

describe("checkDeckExportable", () => {
  it("flags a slide whose fixed-mode field overflows its box", async () => {
    const db = getDb();
    const sunday = await db.getOrCreateSundayByDate("2027-01-10");

    const template = await db.createTemplate({
      slug: "overflow-test",
      nameEn: "Overflow test",
      nameFr: "Test de débordement",
      category: "general",
    });
    await db.upsertTemplateFields(template.id, [
      {
        fieldKey: "headline",
        labelEn: "Headline",
        labelFr: "Titre",
        teamEditable: true,
        required: true,
        x: 0,
        y: 0,
        width: 100,
        height: 60,
        fontFamily: "Arimo",
        fontSize: 80,
        minFontSize: 80,
        fontWeight: 700,
        fontStyle: "normal",
        lineHeight: 1.1,
        letterSpacing: 0,
        alignment: "left",
        textColor: "#ffffff",
        maxLines: 1,
        overflowMode: "fixed",
        textTransform: "none",
        sortOrder: 0,
      },
    ]);

    const overflowingSlide = await db.createSlide({
      sundayId: sunday.id,
      templateId: template.id,
      headline: "THIS HEADLINE IS DEFINITELY TOO LONG TO FIT IN A TINY FIXED BOX",
      status: "ready",
    });

    const result = await checkDeckExportable(sunday.id);

    expect(result.exportable).toBe(false);
    expect(result.blockedSlideIds).toContain(overflowingSlide.id);
  });

  it("flags a slide missing required content", async () => {
    const db = getDb();
    const sunday = await db.getOrCreateSundayByDate("2027-01-17");
    const templates = await db.listTemplates({ status: "published" });
    const template = templates.find((t) => t.fields.some((f) => f.required))!;

    const blankSlide = await db.createSlide({
      sundayId: sunday.id,
      templateId: template.id,
      headline: "",
      status: "invalid",
    });

    const result = await checkDeckExportable(sunday.id);

    expect(result.missingRequiredSlideIds).toContain(blankSlide.id);
    expect(result.exportable).toBe(false);
  });

  it("reports exportable for a deck with reasonable content", async () => {
    const db = getDb();
    const sunday = await db.getOrCreateSundayByDate("2027-01-24");
    const templates = await db.listTemplates({ status: "published" });
    const template = templates.find((t) => t.slug === "welcome") ?? templates[0]!;

    await db.createSlide({
      sundayId: sunday.id,
      templateId: template.id,
      headline: "BIENVENUE",
      content: { line1: "EAJC" },
      status: "ready",
    });

    const result = await checkDeckExportable(sunday.id);

    expect(result.exportable).toBe(true);
    expect(result.blockedSlideIds).toHaveLength(0);
    expect(result.missingRequiredSlideIds).toHaveLength(0);
  });
});
