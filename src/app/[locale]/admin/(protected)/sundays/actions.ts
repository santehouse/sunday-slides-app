"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/data";
import { getRunSheetIntake } from "@/components/admin/runSheetIntake";
import type { ApplyRunSheetState, CreateSundayState, UploadRunSheetState } from "./formState";

/** Backs the "Create Sunday" dialog on both the Dashboard and Sundays list. */
export async function createSundayAction(
  _prev: CreateSundayState,
  formData: FormData,
): Promise<CreateSundayState> {
  const date = String(formData.get("serviceDate") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { status: "error", error: "invalid" };
  }

  const db = getDb();
  const existing = await db.getSundayByDate(date);
  if (existing) {
    return { status: "error", error: "date_exists" };
  }

  const sunday = await db.getOrCreateSundayByDate(date);
  revalidatePath("/admin");
  revalidatePath("/admin/sundays");
  return { status: "success", id: sunday.id };
}

/** Ingests an uploaded run sheet (DOCX/PDF) and returns a preview for Merge/Replace. */
export async function uploadRunSheetAction(
  _prev: UploadRunSheetState,
  formData: FormData,
): Promise<UploadRunSheetState> {
  const file = formData.get("file");
  const sundayDate = String(formData.get("serviceDate") ?? "").trim() || undefined;
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "missing_file" };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { ingestRunSheet, previewRunSheet } = getRunSheetIntake();

  try {
    const runSheet = await ingestRunSheet({
      bytes,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      sourceType: "manual",
      sundayDate,
    });
    const preview = await previewRunSheet(runSheet.id);
    revalidatePath("/admin/sundays");
    return {
      status: "previewing",
      runSheetId: runSheet.id,
      sundayId: runSheet.sundayId,
      filename: runSheet.originalFilename,
      summary: preview.summary,
      items: preview.items,
    };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "unknown" };
  }
}

export async function applyRunSheetAction(
  _prev: ApplyRunSheetState,
  formData: FormData,
): Promise<ApplyRunSheetState> {
  const runSheetId = String(formData.get("runSheetId") ?? "");
  const mode = String(formData.get("mode") ?? "merge") === "replace" ? "replace" : "merge";
  const { applyRunSheet } = getRunSheetIntake();

  try {
    const result = await applyRunSheet(runSheetId, mode);
    revalidatePath("/admin/sundays");
    revalidatePath(`/admin/sundays/${result.sundayId}`);
    revalidatePath("/admin");
    return { status: "success", sundayId: result.sundayId };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "unknown" };
  }
}

export type ReprocessResult =
  | {
      ok: true;
      preview: {
        runSheetId: string;
        summary: { found: number; mapped: number; needsReview: number };
        items: { headline: string; templateName: string | null; status: "ready" | "needs_review" }[];
      };
    }
  | { ok: false; error: string };

/** Reprocesses a run sheet's source file and returns a fresh preview to Merge/Replace. */
export async function reprocessRunSheetAction(runSheetId: string): Promise<ReprocessResult> {
  const { reprocessRunSheet, previewRunSheet } = getRunSheetIntake();
  try {
    const runSheet = await reprocessRunSheet(runSheetId);
    const preview = await previewRunSheet(runSheet.id);
    revalidatePath(`/admin/sundays/${runSheet.sundayId}`);
    revalidatePath("/admin/sundays");
    return {
      ok: true,
      preview: { runSheetId: runSheet.id, summary: preview.summary, items: preview.items },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "unknown" };
  }
}
