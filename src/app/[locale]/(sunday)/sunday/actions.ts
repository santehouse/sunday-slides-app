"use server";

/**
 * Server actions for the single-screen Sunday queue (`/sunday`). Thin wrappers around
 * `src/lib/**` — see CLAUDE.md's "Server Actions live next to the route that owns them".
 */
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/data";
import { extractText } from "@/lib/run-sheets/extract";
import { randomUUID } from "node:crypto";
import { getObjectStore, getSignedReadUrl, keys, putObject } from "@/lib/r2/client";
import { hasR2 } from "@/lib/env";
import { ingestRunSheet, applyRunSheet, previewRunSheet, reprocessRunSheet } from "@/lib/sunday/intake";
import { createSlideFromTemplate, duplicateSlide, removeSlide, rememberMapping } from "@/lib/sunday/slides";
import type { RunSheetPreview } from "@/lib/sunday/contracts";
import type { Slide, SlideBackgroundMode, SlideContent, SlideStatus } from "@/lib/domain/types";
import { readImageDimensions } from "@/components/admin/imageDimensions";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/pdf",
]);

function revalidateQueue(): void {
  revalidatePath("/sunday");
}

// ---------------------------------------------------------------------------
// Queue: reorder / remove / film toggle / clear
// ---------------------------------------------------------------------------

export async function reorderSlidesAction(sundayId: string, orderedIds: string[]): Promise<void> {
  await getDb().reorderSlides(sundayId, orderedIds);
  revalidateQueue();
}

type RemoveSlideResult = Awaited<ReturnType<typeof removeSlide>>;

export async function removeSlideAction(slideId: string): Promise<RemoveSlideResult> {
  const result = await removeSlide(slideId);
  if (result.ok) revalidateQueue();
  return result;
}

export async function toggleIncludeInVideoAction(slideId: string, includeInVideo: boolean): Promise<Slide> {
  const slide = await getDb().updateSlide(slideId, { includeInVideo });
  revalidateQueue();
  return slide;
}

/** Removes every removable slide for the current service — structural "always" slides are left in place. */
export async function clearQueueAction(sundayId: string): Promise<{ removed: number; kept: number }> {
  const db = getDb();
  const slides = await db.listSlidesForSunday(sundayId);
  let removed = 0;
  let kept = 0;
  for (const slide of slides) {
    const result = await removeSlide(slide.id);
    if (result.ok) removed += 1;
    else kept += 1;
  }
  revalidateQueue();
  return { removed, kept };
}

const MIN_HOLD_SECONDS = 1;
const MAX_HOLD_SECONDS = 30;

/** Updates the current service's global default slide hold ("Seconds per slide in the video"), clamped 1-30s. */
export async function updateHoldSecondsAction(sundayId: string, seconds: number): Promise<number> {
  const clamped = Math.min(MAX_HOLD_SECONDS, Math.max(MIN_HOLD_SECONDS, Math.round(seconds)));
  const sunday = await getDb().updateSunday(sundayId, { defaultSlideHoldSeconds: clamped });
  revalidateQueue();
  return sunday.defaultSlideHoldSeconds;
}

// ---------------------------------------------------------------------------
// Slide edit / add / duplicate
// ---------------------------------------------------------------------------

export interface SaveSlideInput {
  templateId: string;
  headline: string;
  content: SlideContent;
  backgroundMode: SlideBackgroundMode;
  approvedColorId: string | null;
  assetId: string | null;
  includeInVideo: boolean;
  status: SlideStatus;
  rememberMappingTemplateId?: string;
}

export async function saveSlideAction(slideId: string, input: SaveSlideInput): Promise<Slide> {
  const slide = await getDb().updateSlide(slideId, {
    templateId: input.templateId,
    headline: input.headline,
    content: input.content,
    backgroundMode: input.backgroundMode,
    approvedColorId: input.approvedColorId,
    assetId: input.assetId,
    includeInVideo: input.includeInVideo,
    status: input.status,
    manuallyEdited: true,
  });

  if (input.rememberMappingTemplateId) {
    await rememberMapping(slideId, input.rememberMappingTemplateId);
  }

  revalidateQueue();
  return slide;
}

export async function duplicateSlideAction(slideId: string): Promise<Slide> {
  const slide = await duplicateSlide(slideId);
  revalidateQueue();
  return slide;
}

export async function createSlideFromTemplateAction(sundayId: string, templateId: string): Promise<Slide> {
  const slide = await createSlideFromTemplate(sundayId, templateId);
  revalidateQueue();
  return slide;
}

// ---------------------------------------------------------------------------
// Import announcements
// ---------------------------------------------------------------------------

/** Manual upload from the Import modal — parses immediately (unlike inbound email intake). */
export async function uploadRunSheetAction(formData: FormData, sundayId: string): Promise<{ runSheetId: string }> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("No file provided");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("file_too_large");
  }
  if (file.type && !ACCEPTED_MIME_TYPES.has(file.type)) {
    throw new Error("unsupported_file");
  }

  const db = getDb();
  const sunday = await db.getSundayById(sundayId);
  if (!sunday) throw new Error(`uploadRunSheetAction: Sunday ${sundayId} not found`);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const runSheet = await ingestRunSheet({
    bytes,
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    sourceType: "manual",
    sundayDate: sunday.serviceDate,
    parse: true,
  });
  revalidateQueue();
  return { runSheetId: runSheet.id };
}

export async function previewRunSheetAction(runSheetId: string): Promise<RunSheetPreview> {
  return previewRunSheet(runSheetId);
}

/** Marks a run sheet as opened (previewed or used) — clears the Import modal's "new" dot. */
export async function markRunSheetOpenedAction(runSheetId: string): Promise<void> {
  const db = getDb();
  const runSheet = await db.getRunSheet(runSheetId);
  if (!runSheet || runSheet.openedAt) return;
  await db.updateRunSheet(runSheetId, { openedAt: new Date().toISOString() });
  revalidateQueue();
}

export interface RunSheetTextPreview {
  kind: "text";
  text: string;
}
export interface RunSheetFileUrlPreview {
  kind: "pdf";
  url: string;
}
export interface RunSheetPreviewFailed {
  kind: "failed";
}
export type RunSheetContentPreview = RunSheetTextPreview | RunSheetFileUrlPreview | RunSheetPreviewFailed;

/** Extracted text for a DOCX (from the stored parse, or extracted on demand), or a PDF's file URL to embed. */
export async function getRunSheetContentPreviewAction(runSheetId: string): Promise<RunSheetContentPreview> {
  const db = getDb();
  const runSheet = await db.getRunSheet(runSheetId);
  if (!runSheet) return { kind: "failed" };

  await markRunSheetOpenedAction(runSheetId);

  const isPdf = runSheet.mimeType.toLowerCase() === "application/pdf" || runSheet.originalFilename.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    if (hasR2()) {
      return { kind: "pdf", url: await getSignedReadUrl(runSheet.r2Key) };
    }
    return { kind: "pdf", url: `/api/run-sheets/${runSheet.id}/file` };
  }

  if (runSheet.extractedText) {
    return { kind: "text", text: runSheet.extractedText };
  }

  try {
    const bytes = await getObjectStore().getObject(runSheet.r2Key);
    const result = await extractText(bytes, runSheet.mimeType, runSheet.originalFilename);
    return { kind: "text", text: result.text };
  } catch {
    return { kind: "failed" };
  }
}

export interface UseRunSheetResult {
  ok: boolean;
  summary?: { found: number; mapped: number; needsReview: number };
}

/**
 * "Use this file": parses on demand if it hasn't been parsed yet (`parseStatus ===
 * "queued"`, e.g. inbound email), then applies it to the current service — replacing the
 * queue when nothing has been manually edited yet, merging (preserving edits) otherwise.
 */
export async function activateRunSheetFileAction(runSheetId: string): Promise<UseRunSheetResult> {
  const db = getDb();
  let runSheet = await db.getRunSheet(runSheetId);
  if (!runSheet) throw new Error(`activateRunSheetFileAction: run sheet ${runSheetId} not found`);

  if (runSheet.parseStatus === "queued") {
    runSheet = await reprocessRunSheet(runSheetId);
  }

  if (!runSheet.parsedJson) {
    return { ok: false };
  }

  const beforeSlides = await db.listSlidesForSunday(runSheet.sundayId);
  const mode: "merge" | "replace" = beforeSlides.some((s) => s.manuallyEdited) ? "merge" : "replace";

  const result = await applyRunSheet(runSheetId, mode);
  await markRunSheetOpenedAction(runSheetId);
  revalidateQueue();
  return { ok: true, summary: result.summary };
}

// ---------------------------------------------------------------------------
// Image fields: the Sunday team drops a picture into a template's image slot
// ---------------------------------------------------------------------------

const MAX_SLIDE_IMAGE_BYTES = 4 * 1024 * 1024; // Server Actions cap (next.config.ts)
const SLIDE_IMAGE_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export type UploadSlideImageResult =
  | { ok: true; key: string }
  | { ok: false; error: "missing_file" | "unsupported_file" | "file_too_large" | "storage_failed" };

/** Stores a picture for an image field and returns the storage key the slide content holds. */
export async function uploadSlideImageAction(formData: FormData): Promise<UploadSlideImageResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "missing_file" };
  if (file.size > MAX_SLIDE_IMAGE_BYTES) return { ok: false, error: "file_too_large" };
  const ext = SLIDE_IMAGE_EXT[file.type];
  if (!ext) return { ok: false, error: "unsupported_file" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!readImageDimensions(bytes)) return { ok: false, error: "unsupported_file" };
  const key = keys.slideImages(randomUUID(), ext);
  try {
    await putObject(key, bytes, file.type);
  } catch (error) {
    console.error("uploadSlideImageAction: storage failed", error);
    return { ok: false, error: "storage_failed" };
  }
  return { ok: true, key };
}
