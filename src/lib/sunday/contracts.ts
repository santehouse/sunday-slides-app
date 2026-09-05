/**
 * Shared type contracts for `src/lib/sunday/*` — screen agents (Sunday Team
 * and Admin UI) import from here rather than reaching into each module
 * directly. Type-only re-exports: importing this file never pulls in any of
 * the underlying modules' runtime code (object store, renderer, ffmpeg, …).
 */
export type { ApplyRunSheetResult, IngestInput, RunSheetPreview, RunSheetPreviewItem } from "./intake";
export type {
  DeckExportability,
  ExportBlocked,
  ExportFormat,
  ExportRequest,
  ExportResult,
  ExportScope,
} from "./exports";
export type { BuildRenderInputOptions } from "./render-input";
export type { RemoveSlideResult } from "./slides";
