import "server-only";

/**
 * JPG/MP4 export orchestration (sections 8-10/38 of BUILD_HANDOFF.md): resolves the
 * requested slide scope in Sunday Flow order, renders through the one shared renderer,
 * and blocks on the same text-fit verdict the Slide Editor shows — export never
 * silently ships clipped or missing content.
 */
import JSZip from "jszip";
import { getDb } from "@/lib/data";
import { buildExportFilenames } from "@/lib/engines/slugFilename";
import { buildRenderInput } from "./render-input";
import { renderSlidesToJpegs } from "@/lib/renderer/server";
import { fitSlide } from "@/lib/renderer/fitText";
import { buildMp4 } from "@/lib/exports/mp4";
import { keys, putObject } from "@/lib/r2/client";
import type { ExportType, Slide } from "@/lib/domain/types";
import type { TextMeasurer } from "@/lib/renderer/types";

export type ExportFormat = "jpg" | "mp4";
export type ExportScope = "current" | "all" | "custom";

export interface ExportRequest {
  sundayId: string;
  format: ExportFormat;
  scope: ExportScope;
  /** 1-based slide numbers in Sunday Flow order — required (and validated against the deck size) when scope is "custom". */
  slideNumbers?: number[];
  /** Required when scope is "current". */
  currentSlideId?: string;
}

export type ExportBlocked = {
  ok: false;
  error: "text_overflow" | "missing_required" | "nothing_to_export" | "render_failed" | "encode_failed";
  slideIds?: string[];
  message?: string;
};

export type ExportResult =
  | { ok: true; filename: string; contentType: string; bytes: Uint8Array; jobId: string }
  | ExportBlocked;

export interface DeckExportability {
  exportable: boolean;
  blockedSlideIds: string[];
  missingRequiredSlideIds: string[];
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function nowIso(): string {
  return new Date().toISOString();
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The date used in zip/MP4 export filenames: the applied run sheet's own parsed
 * `serviceDate` when it's a real `YYYY-MM-DD` value (the pastor's document may name a
 * different date than the Sunday record it landed on), falling back to the Sunday's own
 * `serviceDate`. Never moves the Sunday itself — filenames only.
 */
async function resolveExportDate(db: ReturnType<typeof getDb>, sunday: { serviceDate: string; sourceRunSheetId: string | null }): Promise<string> {
  if (!sunday.sourceRunSheetId) return sunday.serviceDate;
  const runSheet = await db.getRunSheet(sunday.sourceRunSheetId);
  const parsedDate = runSheet?.parsedJson?.serviceDate;
  return parsedDate && ISO_DATE_RE.test(parsedDate) ? parsedDate : sunday.serviceDate;
}

/** Resolves `req`'s scope against the full Sunday Flow. `null` means the request itself is unusable. */
function resolveScope(req: ExportRequest, allSlides: Slide[]): Slide[] | null {
  if (req.scope === "all") return allSlides;

  if (req.scope === "current") {
    if (!req.currentSlideId) return null;
    const found = allSlides.find((s) => s.id === req.currentSlideId);
    return found ? [found] : null;
  }

  // scope === "custom" — same bounds semantics as `parseSlideRange`: 1-based, deduped, sorted.
  if (!req.slideNumbers || req.slideNumbers.length === 0) return null;
  const valid = Array.from(new Set(req.slideNumbers))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= allSlides.length)
    .sort((a, b) => a - b);
  if (valid.length === 0) return null;
  return valid.map((n) => allSlides[n - 1]);
}

/**
 * Runs a JPG or MP4 export for `req`, in exact Sunday Flow order. JPG filenames are
 * always prefixed by the slide's position in the FULL flow (never the subset's own
 * index) — see `buildExportFilenames` / section 9. Blocks (never partially exports) on
 * overflowing or missing-required content, marking the offending slides `invalid`.
 */
export async function runExport(req: ExportRequest): Promise<ExportResult> {
  const db = getDb();
  const sunday = await db.getSundayById(req.sundayId);
  if (!sunday) return { ok: false, error: "nothing_to_export" };

  const allSlides = (await db.listSlidesForSunday(req.sundayId)).sort((a, b) => a.sortOrder - b.sortOrder);
  if (allSlides.length === 0) return { ok: false, error: "nothing_to_export" };

  const scoped = resolveScope(req, allSlides);
  if (!scoped || scoped.length === 0) return { ok: false, error: "nothing_to_export" };

  // MP4 respects `includeInVideo`; JPG ignores it entirely. Excluded slides are dropped
  // silently from THIS export only — never "upgraded" into inclusion.
  const selected = req.format === "mp4" ? scoped.filter((s) => s.includeInVideo) : scoped;
  if (selected.length === 0) return { ok: false, error: "nothing_to_export" };

  const fullFlowFilenames = buildExportFilenames(allSlides.map((s) => ({ headline: s.headline })));
  const filenameById = new Map(allSlides.map((s, i) => [s.id, fullFlowFilenames[i]]));
  const flowPositionById = new Map(allSlides.map((s, i) => [s.id, i + 1]));

  const jobType: ExportType = req.format === "mp4" ? "mp4" : selected.length > 1 ? "jpg_zip" : "jpg";
  const job = await db.createExportJob({
    sundayId: req.sundayId,
    type: jobType,
    status: "queued",
    selection: {
      format: req.format,
      scope: req.scope,
      slideNumbers: selected.map((s) => flowPositionById.get(s.id) ?? 0),
    },
  });

  const fail = async (
    error: ExportBlocked["error"],
    message?: string,
    slideIds?: string[],
  ): Promise<ExportBlocked> => {
    await db.updateExportJob(job.id, { status: "failed", error: message ?? error, completedAt: nowIso() });
    return { ok: false, error, message, slideIds };
  };

  await db.updateExportJob(job.id, { status: "processing" });

  const exportDate = await resolveExportDate(db, sunday);

  const renderInputs = await Promise.all(selected.map((slide) => buildRenderInput(slide, { showSafeZone: false })));

  let rendered: Awaited<ReturnType<typeof renderSlidesToJpegs>>;
  try {
    rendered = await renderSlidesToJpegs(renderInputs);
  } catch (err) {
    return fail("render_failed", describeError(err));
  }

  const missingRequiredSlideIds = rendered.filter((r) => r.fit.missingRequired.length > 0).map((r) => r.fit.slideId);
  if (missingRequiredSlideIds.length > 0) {
    await Promise.all(missingRequiredSlideIds.map((id) => db.updateSlide(id, { status: "invalid" })));
    return fail("missing_required", undefined, missingRequiredSlideIds);
  }

  const overflowSlideIds = rendered.filter((r) => !r.fit.exportable).map((r) => r.fit.slideId);
  if (overflowSlideIds.length > 0) {
    // Which field of which slide, and why — the function logs are the only place to see it.
    for (const r of rendered) {
      if (r.fit.exportable) continue;
      const overflowing = r.fit.fields.filter((f) => f.status === "overflow").map((f) => `${f.fieldKey}:${f.reason ?? "?"}`);
      console.warn(`export: text overflow on slide ${r.fit.slideId} — ${overflowing.join(", ")}`);
    }
    await Promise.all(overflowSlideIds.map((id) => db.updateSlide(id, { status: "invalid" })));
    return fail("text_overflow", undefined, overflowSlideIds);
  }

  if (req.format === "jpg") {
    const files = selected.map((slide, i) => ({
      name: filenameById.get(slide.id) ?? `${String(i + 1).padStart(2, "0")}-slide.jpg`,
      bytes: rendered[i].jpeg,
    }));

    let filename: string;
    let contentType: string;
    let bytes: Uint8Array;
    let exportKey: string;

    if (files.length === 1) {
      filename = files[0].name;
      contentType = "image/jpeg";
      bytes = files[0].bytes;
      exportKey = keys.exportsJpg(sunday.serviceDate, job.id);
    } else {
      const zip = new JSZip();
      for (const file of files) zip.file(file.name, file.bytes);
      bytes = await zip.generateAsync({ type: "uint8array" });
      filename = `${exportDate}-slides.zip`;
      contentType = "application/zip";
      exportKey = keys.exportsZip(sunday.serviceDate, job.id);
    }

    try {
      await putObject(exportKey, bytes, contentType);
    } catch (err) {
      return fail("render_failed", describeError(err));
    }

    await db.updateExportJob(job.id, { status: "complete", outputR2Key: exportKey, completedAt: nowIso() });
    await db.updateSunday(sunday.id, { status: "exported" });
    return { ok: true, filename, contentType, bytes, jobId: job.id };
  }

  // MP4 — never let this branch's failure affect a separate JPG export call (they're
  // always two independent `runExport` invocations, one per format).
  let mp4Bytes: Uint8Array;
  try {
    mp4Bytes = await buildMp4({
      frames: rendered.map((r) => ({ jpeg: r.jpeg })),
      holdSeconds: sunday.defaultSlideHoldSeconds,
    });
  } catch (err) {
    return fail("encode_failed", describeError(err));
  }

  const filename = `${exportDate}-slides.mp4`;
  const exportKey = keys.exportsMp4(sunday.serviceDate, job.id);
  try {
    await putObject(exportKey, mp4Bytes, "video/mp4");
  } catch (err) {
    return fail("encode_failed", describeError(err));
  }

  await db.updateExportJob(job.id, { status: "complete", outputR2Key: exportKey, completedAt: nowIso() });
  await db.updateSunday(sunday.id, { status: "exported" });
  return { ok: true, filename, contentType: "video/mp4", bytes: mp4Bytes, jobId: job.id };
}

/**
 * Deterministic, char-count-based `TextMeasurer` — no canvas/DOM required, so this runs
 * anywhere Node does. Good enough for a fast "does this deck look exportable" check;
 * `runExport` itself still renders through headless Chromium (`fitText`'s real measurer)
 * as the authoritative, blocking check before anything is actually exported.
 */
function approximateMeasurer(): TextMeasurer {
  return {
    measureWidth(text, font) {
      const base = text.length * font.size * 0.55;
      const extra = text.length > 1 ? font.letterSpacing * (text.length - 1) : 0;
      return base + extra;
    },
  };
}

/**
 * Fast, approximate export-readiness check for the Sunday Flow screen (e.g. a "fix
 * before exporting" banner) — never renders a single frame. `runExport`'s own
 * headless-Chromium fit check is the real, blocking gate at export time.
 */
export async function checkDeckExportable(sundayId: string): Promise<DeckExportability> {
  const db = getDb();
  const slides = await db.listSlidesForSunday(sundayId);
  const measurer = approximateMeasurer();

  const blockedSlideIds: string[] = [];
  const missingRequiredSlideIds: string[] = [];

  for (const slide of slides) {
    const template = await db.getTemplate(slide.templateId);
    if (!template) continue;
    const fit = fitSlide(template, slide, measurer);
    if (fit.missingRequired.length > 0) missingRequiredSlideIds.push(slide.id);
    if (!fit.exportable) blockedSlideIds.push(slide.id);
  }

  return { exportable: blockedSlideIds.length === 0, blockedSlideIds, missingRequiredSlideIds };
}
