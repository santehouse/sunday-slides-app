import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

process.env.CP_MOCK_DATA = "1";

const { resetMockStore } = await import("@/lib/data/mockDb");
const { getDb } = await import("@/lib/data");
const { ingestRunSheet, previewRunSheet, applyRunSheet, reprocessRunSheet } = await import("@/lib/sunday/intake");

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const FIXTURE_PATH = resolve(__dirname, "../../fixtures/run-sheets/260906.docx");

function loadFixtureBytes(): Uint8Array {
  return new Uint8Array(readFileSync(FIXTURE_PATH));
}

beforeEach(() => {
  resetMockStore();
});

describe("ingestRunSheet", () => {
  it("processes the real fixture through the heuristic fallback parser in mock mode", async () => {
    const runSheet = await ingestRunSheet({
      bytes: loadFixtureBytes(),
      filename: "260906.docx",
      mimeType: DOCX_MIME,
      sourceType: "manual",
      sundayDate: "2026-09-06",
    });

    expect(["ready_to_apply", "needs_review"]).toContain(runSheet.parseStatus);
    expect(runSheet.extractedText).toContain("ÉTUDE BIBLIQUE");
    expect(runSheet.parsedJson).not.toBeNull();
    expect(runSheet.parsedJson!.sections.length).toBeGreaterThan(0);
    // Records which parser actually ran, for debugging (section 17).
    expect(runSheet.modelOutput).toMatchObject({ parser: "heuristic" });
    expect(runSheet.processedAt).not.toBeNull();
  });

  it("dedupes by inboundEventId, returning the existing run sheet without reprocessing", async () => {
    const bytes = loadFixtureBytes();
    const first = await ingestRunSheet({
      bytes,
      filename: "260906.docx",
      mimeType: DOCX_MIME,
      sourceType: "email",
      sundayDate: "2026-09-06",
      inboundEventId: "evt_dedupe_1",
    });
    const second = await ingestRunSheet({
      bytes,
      filename: "260906.docx",
      mimeType: DOCX_MIME,
      sourceType: "email",
      sundayDate: "2026-09-06",
      inboundEventId: "evt_dedupe_1",
    });

    expect(second.id).toBe(first.id);
  });

  it("never throws for an unsupported file type — marks the run sheet failed instead", async () => {
    const runSheet = await ingestRunSheet({
      bytes: new Uint8Array([1, 2, 3, 4]),
      filename: "photo.png",
      mimeType: "image/png",
      sourceType: "manual",
      sundayDate: "2026-09-06",
    });

    expect(runSheet.parseStatus).toBe("failed");
    expect(runSheet.parseError).toContain("Unsupported");
  });

  it("never throws for an oversized file — marks the run sheet failed instead", async () => {
    const oversized = new Uint8Array(10 * 1024 * 1024 + 1);
    const runSheet = await ingestRunSheet({
      bytes: oversized,
      filename: "huge.docx",
      mimeType: DOCX_MIME,
      sourceType: "manual",
      sundayDate: "2026-09-06",
    });

    expect(runSheet.parseStatus).toBe("failed");
    expect(runSheet.parseError).toMatch(/exceeds/i);
  });
});

describe("previewRunSheet", () => {
  it("produces summary counts and per-announcement items without writing any slides", async () => {
    const runSheet = await ingestRunSheet({
      bytes: loadFixtureBytes(),
      filename: "260906.docx",
      mimeType: DOCX_MIME,
      sourceType: "manual",
      sundayDate: "2026-09-13",
    });

    const preview = await previewRunSheet(runSheet.id);

    // The heuristic parser resolves the fixture to 8 announcements (2 bullet-based in
    // "Rendez-vous de la semaine", 4 in "Événements à venir", and one section-level
    // announcement each for "Dîmes et offrandes" and "Conférence EAJC" — see
    // heuristicParse.ts's doc comment and scripts/parse-fixture.ts's output).
    expect(preview.summary.found).toBeGreaterThanOrEqual(8);
    expect(preview.summary.found).toBeLessThanOrEqual(9);
    expect(preview.items).toHaveLength(preview.summary.found);
    // Étude biblique, Culte d'adoration, Veillée des hommes, Dîmes et offrandes match
    // exactly; Baptêmes and Prière matinale (typo'd "matinales" in the fixture) match
    // via plan.ts's fuzzy matcher — six of eight resolve to a real template.
    expect(preview.summary.mapped).toBeGreaterThanOrEqual(5);
    for (const item of preview.items) {
      expect(item.headline.length).toBeGreaterThan(0);
      expect(["ready", "needs_review"]).toContain(item.status);
    }

    const db = getDb();
    const sunday = await db.getSundayByDate("2026-09-13");
    const slides = await db.listSlidesForSunday(sunday!.id);
    expect(slides).toHaveLength(0);
  });
});

describe("applyRunSheet", () => {
  it("replace mode creates structural + announcement slides in Sunday Flow order", async () => {
    const runSheet = await ingestRunSheet({
      bytes: loadFixtureBytes(),
      filename: "260906.docx",
      mimeType: DOCX_MIME,
      sourceType: "manual",
      sundayDate: "2026-09-20",
    });

    const result = await applyRunSheet(runSheet.id, "replace");
    expect(result.serviceDate).toBe("2026-09-20");
    expect(result.summary.found).toBeGreaterThan(0);

    const db = getDb();
    const slides = await db.listSlidesForSunday(result.sundayId);
    expect(slides.length).toBeGreaterThan(4);

    // Welcome (always, opening) leads the flow, "See you next week" (always, closing) ends it.
    expect(slides[0].isStructural).toBe(true);
    expect(slides[0].headline).toBe("BIENVENUE");
    expect(slides[slides.length - 1].isStructural).toBe(true);
    expect(slides[slides.length - 1].headline).toBe("À LA SEMAINE PROCHAINE");

    // "Rendez-vous de la semaine" (its first-day headline is "Mercredi") sits right before
    // the announcement block.
    const rendezVousIndex = slides.findIndex((s) => s.headline === "Mercredi");
    expect(rendezVousIndex).toBeGreaterThan(0);
    expect(slides[rendezVousIndex].isStructural).toBe(true);
    expect(slides[rendezVousIndex + 1].isStructural).toBe(false);

    // sortOrder is contiguous 0..n-1, matching array order (section 7's "one order").
    slides.forEach((slide, index) => expect(slide.sortOrder).toBe(index));

    const runSheetAfter = await db.getRunSheet(runSheet.id);
    expect(runSheetAfter!.parseStatus).toBe("added_to_flow");

    const sunday = await db.getSundayById(result.sundayId);
    expect(sunday!.sourceRunSheetId).toBe(runSheet.id);
    expect(["ready", "needs_review"]).toContain(sunday!.status);
  });

  it("merge mode preserves a manually edited slide's content", async () => {
    const bytes = loadFixtureBytes();
    const runSheet1 = await ingestRunSheet({
      bytes,
      filename: "260906.docx",
      mimeType: DOCX_MIME,
      sourceType: "manual",
      sundayDate: "2026-09-27",
    });
    const applied1 = await applyRunSheet(runSheet1.id, "replace");

    const db = getDb();
    const slidesBefore = await db.listSlidesForSunday(applied1.sundayId);
    const target = slidesBefore.find((s) => s.headline === "ÉTUDE BIBLIQUE");
    expect(target).toBeDefined();

    const editedHeadline = "ÉTUDE BIBLIQUE — HORAIRE MODIFIÉ";
    await db.updateSlide(target!.id, { headline: editedHeadline, manuallyEdited: true });

    // The pastor re-sends the exact same run sheet — merging it back in must not clobber
    // the manual edit (section 15/18: manual edits survive an unchanged source).
    const runSheet2 = await ingestRunSheet({
      bytes,
      filename: "260906.docx",
      mimeType: DOCX_MIME,
      sourceType: "manual",
      sundayDate: "2026-09-27",
    });
    await applyRunSheet(runSheet2.id, "merge");

    const slidesAfter = await db.listSlidesForSunday(applied1.sundayId);
    const preserved = slidesAfter.find((s) => s.id === target!.id);
    expect(preserved).toBeDefined();
    expect(preserved!.headline).toBe(editedHeadline);
  });
});

describe("reprocessRunSheet", () => {
  it("re-reads the stored bytes and re-runs extraction + parsing", async () => {
    const runSheet = await ingestRunSheet({
      bytes: loadFixtureBytes(),
      filename: "260906.docx",
      mimeType: DOCX_MIME,
      sourceType: "manual",
      sundayDate: "2026-10-04",
    });

    const reprocessed = await reprocessRunSheet(runSheet.id);
    expect(reprocessed.id).toBe(runSheet.id);
    expect(reprocessed.extractedText).toContain("ÉTUDE BIBLIQUE");
    expect(reprocessed.parsedJson).not.toBeNull();
    expect(["ready_to_apply", "needs_review"]).toContain(reprocessed.parseStatus);
  });
});
