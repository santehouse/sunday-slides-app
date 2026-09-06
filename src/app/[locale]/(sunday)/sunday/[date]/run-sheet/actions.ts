"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/data";
import { applyRunSheet, ingestRunSheet, previewRunSheet, reprocessRunSheet } from "@/lib/sunday/intake";
import type { RunSheetPreview } from "@/lib/sunday/contracts";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/pdf",
]);

function revalidateSunday(date: string): void {
  revalidatePath(`/sunday/${date}`);
  revalidatePath(`/sunday/${date}/run-sheet`);
  revalidatePath(`/sunday/${date}/download`);
}

/** Reads the uploaded file and runs it through the same pipeline as email intake. */
export async function uploadRunSheetAction(formData: FormData, sundayDate: string): Promise<{ runSheetId: string }> {
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

  const bytes = new Uint8Array(await file.arrayBuffer());
  const runSheet = await ingestRunSheet({
    bytes,
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    sourceType: "manual",
    sundayDate,
  });
  revalidateSunday(sundayDate);
  return { runSheetId: runSheet.id };
}

export async function previewRunSheetAction(runSheetId: string): Promise<RunSheetPreview> {
  return previewRunSheet(runSheetId);
}

export async function reprocessRunSheetAction(runSheetId: string): Promise<RunSheetPreview> {
  await reprocessRunSheet(runSheetId);
  return previewRunSheet(runSheetId);
}

export interface ActivateRunSheetResult {
  date: string;
  /** Announcements found in the run sheet, mirrors `applyRunSheet`'s summary. */
  summary: { found: number; mapped: number; needsReview: number };
  /** Set only when the target Sunday had manual edits — how many of them survived. */
  mergedKeptCount: number | null;
}

/**
 * "Use this run sheet" (Simplified Sunday IA, Step 1): silently replaces the deck when
 * the target Sunday has no manual edits yet, or merges (preserving them) when it does.
 * (Named `activate…`, not `use…` — the latter trips the `react-hooks/rules-of-hooks`
 * lint rule since it's imported straight into a client component.)
 */
export async function activateRunSheetAction(runSheetId: string): Promise<ActivateRunSheetResult> {
  const db = getDb();
  const runSheet = await db.getRunSheet(runSheetId);
  if (!runSheet) throw new Error(`useRunSheetAction: run sheet ${runSheetId} not found`);

  const beforeSlides = await db.listSlidesForSunday(runSheet.sundayId);
  const manuallyEditedIds = new Set(beforeSlides.filter((s) => s.manuallyEdited).map((s) => s.id));
  const mode: "merge" | "replace" = manuallyEditedIds.size > 0 ? "merge" : "replace";

  const result = await applyRunSheet(runSheetId, mode);

  let mergedKeptCount: number | null = null;
  if (mode === "merge") {
    const afterSlides = await db.listSlidesForSunday(runSheet.sundayId);
    const afterIds = new Set(afterSlides.map((s) => s.id));
    mergedKeptCount = [...manuallyEditedIds].filter((id) => afterIds.has(id)).length;
  }

  revalidateSunday(result.serviceDate);
  return { date: result.serviceDate, summary: result.summary, mergedKeptCount };
}
