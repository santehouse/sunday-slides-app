"use server";

import { revalidatePath } from "next/cache";
import { ingestRunSheet, previewRunSheet, applyRunSheet, reprocessRunSheet } from "@/lib/sunday/intake";
import type { RunSheetPreview } from "@/lib/sunday/contracts";

type ApplyRunSheetResult = Awaited<ReturnType<typeof applyRunSheet>>;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/pdf",
]);

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
  return { runSheetId: runSheet.id };
}

export async function previewRunSheetAction(runSheetId: string): Promise<RunSheetPreview> {
  return previewRunSheet(runSheetId);
}

export async function reprocessRunSheetAction(runSheetId: string): Promise<RunSheetPreview> {
  await reprocessRunSheet(runSheetId);
  return previewRunSheet(runSheetId);
}

export async function applyRunSheetAction(
  runSheetId: string,
  mode: "merge" | "replace",
  date: string,
): Promise<ApplyRunSheetResult> {
  const result = await applyRunSheet(runSheetId, mode);
  revalidatePath(`/sunday/${date}/flow`);
  revalidatePath(`/sunday/${date}`);
  revalidatePath(`/sunday/${date}/upload`);
  return result;
}
