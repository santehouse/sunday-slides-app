/**
 * Client-facing state shapes for the Sundays screens + their initial values.
 * Kept out of `actions.ts` because a "use server" file may only export async
 * functions — a plain object export (like `initialCreateSundayState`) trips
 * Next's "A 'use server' file can only export async functions" build error.
 */
export type CreateSundayState =
  | { status: "idle" }
  | { status: "error"; error: "date_exists" | "invalid" }
  | { status: "success"; id: string };

export const initialCreateSundayState: CreateSundayState = { status: "idle" };

export type UploadRunSheetState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "previewing";
      runSheetId: string;
      sundayId: string;
      filename: string;
      summary: { found: number; mapped: number; needsReview: number };
      items: { headline: string; templateName: string | null; status: "ready" | "needs_review" }[];
    }
  | { status: "applied"; sundayId: string };

export const initialUploadRunSheetState: UploadRunSheetState = { status: "idle" };

export type ApplyRunSheetState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; sundayId: string };

export const initialApplyRunSheetState: ApplyRunSheetState = { status: "idle" };
