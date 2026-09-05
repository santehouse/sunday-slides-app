import "server-only";

/**
 * Bridge to the run-sheet intake pipeline (`@/lib/sunday/intake`). Admin code calls
 * these four functions only through this module so the dependency stays in one place.
 */
import { applyRunSheet, ingestRunSheet, previewRunSheet, reprocessRunSheet } from "@/lib/sunday/intake";
import type { RunSheet } from "@/lib/domain/types";
import type { ApplyRunSheetResult, IngestInput, RunSheetPreview } from "@/lib/sunday/contracts";

export type { IngestInput, RunSheetPreview } from "@/lib/sunday/contracts";

export interface RunSheetIntake {
  ingestRunSheet(input: IngestInput): Promise<RunSheet>;
  previewRunSheet(runSheetId: string): Promise<RunSheetPreview>;
  applyRunSheet(runSheetId: string, mode: "merge" | "replace"): Promise<ApplyRunSheetResult>;
  reprocessRunSheet(runSheetId: string): Promise<RunSheet>;
}

const real: RunSheetIntake = { ingestRunSheet, previewRunSheet, applyRunSheet, reprocessRunSheet };

export function getRunSheetIntake(): RunSheetIntake {
  return real;
}
