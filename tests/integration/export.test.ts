/**
 * End-to-end export integration test — the real headless-Chromium renderer + real
 * ffmpeg, no mocks beyond `CP_MOCK_DATA` (still an in-memory Db; only the render/encode
 * pipeline is real). Requires a local Chromium and ffmpeg (see docs/RENDERING.md) and is
 * slow, so it's opt-in:
 *
 *   RUN_INTEGRATION=1 pnpm tsx --tsconfig scripts/tsconfig.json ./node_modules/.bin/vitest run tests/integration/export.test.ts
 *   # or, once RUN_INTEGRATION=1 is exported: pnpm test tests/integration/export.test.ts
 */
import { beforeEach, describe, expect, it } from "vitest";

process.env.CP_MOCK_DATA = "1";

const { resetMockStore } = await import("@/lib/data/mockDb");
const { getDb } = await import("@/lib/data");
const { runExport } = await import("@/lib/sunday/exports");

const DEMO_SUNDAY_DATE = "2026-09-06";

beforeEach(() => {
  resetMockStore();
});

describe.skipIf(!process.env.RUN_INTEGRATION)("runExport (real renderer + ffmpeg)", () => {
  it("exports the seeded demo Sunday to a JPG zip", async () => {
    const db = getDb();
    const sunday = await db.getSundayByDate(DEMO_SUNDAY_DATE);
    expect(sunday).not.toBeNull();
    const slides = await db.listSlidesForSunday(sunday!.id);
    expect(slides.length).toBeGreaterThan(1);

    const result = await runExport({ sundayId: sunday!.id, format: "jpg", scope: "all" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contentType).toBe("application/zip");
    expect(result.filename).toBe(`${DEMO_SUNDAY_DATE}-sunday-flow.zip`);
    expect(result.bytes.byteLength).toBeGreaterThan(0);
    // A real ZIP starts with the local file header signature "PK\x03\x04".
    expect(result.bytes[0]).toBe(0x50);
    expect(result.bytes[1]).toBe(0x4b);

    const updatedSunday = await db.getSundayById(sunday!.id);
    expect(updatedSunday!.status).toBe("exported");

    const jobs = await db.listRecentExportJobs(5);
    const job = jobs.find((j) => j.id === result.jobId);
    expect(job).toBeDefined();
    expect(job!.status).toBe("complete");
    expect(job!.outputR2Key).not.toBeNull();
  }, 60_000);

  it("exports a single current slide as one JPG (not a zip)", async () => {
    const db = getDb();
    const sunday = await db.getSundayByDate(DEMO_SUNDAY_DATE);
    const slides = await db.listSlidesForSunday(sunday!.id);
    const currentSlideId = slides[0]!.id;

    const result = await runExport({ sundayId: sunday!.id, format: "jpg", scope: "current", currentSlideId });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contentType).toBe("image/jpeg");
    expect(result.filename).toMatch(/^01-/); // full-flow position, not subset index
    expect(result.bytes.byteLength).toBeGreaterThan(0);
  }, 30_000);

  it("exports the demo Sunday to an MP4", async () => {
    const db = getDb();
    const sunday = await db.getSundayByDate(DEMO_SUNDAY_DATE);

    const result = await runExport({ sundayId: sunday!.id, format: "mp4", scope: "all" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contentType).toBe("video/mp4");
    expect(result.filename).toBe(`${DEMO_SUNDAY_DATE}-sunday-flow.mp4`);
    expect(result.bytes.byteLength).toBeGreaterThan(0);
    // MP4 "ftyp" box signature at byte offset 4.
    expect(Buffer.from(result.bytes.slice(4, 8)).toString("ascii")).toBe("ftyp");
  }, 90_000);

  it("blocks export with text_overflow and marks the slide invalid", async () => {
    const db = getDb();
    const sunday = await db.getOrCreateSundayByDate("2027-02-07");

    const template = await db.createTemplate({
      slug: "integration-overflow-test",
      nameEn: "Integration overflow test",
      nameFr: "Test de débordement (intégration)",
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
        width: 80,
        height: 60,
        fontFamily: "Arimo",
        fontSize: 96,
        minFontSize: 96,
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
    const slide = await db.createSlide({
      sundayId: sunday.id,
      templateId: template.id,
      headline: "THIS TEXT CANNOT POSSIBLY FIT IN SUCH A TINY FIXED BOX",
      status: "ready",
    });

    const result = await runExport({ sundayId: sunday.id, format: "jpg", scope: "all" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("text_overflow");
    expect(result.slideIds).toContain(slide.id);

    const updatedSlide = await db.getSlide(slide.id);
    expect(updatedSlide!.status).toBe("invalid");
  }, 30_000);
});
