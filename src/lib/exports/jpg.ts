import "server-only";

/**
 * JPG export (section 9 of BUILD_HANDOFF.md): one 1920×1080 JPEG per slide, ZIP'd
 * together when there's more than one, always via the shared server renderer so the
 * output pixel-matches the browser preview and the MP4 frames.
 */
import JSZip from "jszip";
import { renderSlidesToJpegs } from "@/lib/renderer/server";
import type { RenderSlideInput } from "@/lib/renderer/types";

export class JpgExportBlockedError extends Error {
  /** Slide ids whose fields overflow or are missing required content. */
  readonly blockedSlideIds: string[];

  constructor(blockedSlideIds: string[]) {
    super(
      `JPG export blocked: slide(s) ${blockedSlideIds.join(", ")} have overflowing or missing-required text and ` +
        "must be corrected before exporting.",
    );
    this.name = "JpgExportBlockedError";
    this.blockedSlideIds = blockedSlideIds;
  }
}

export interface JpgExportFile {
  name: string;
  bytes: Uint8Array;
}

export interface JpgExportResult {
  files: JpgExportFile[];
  /** Present only when more than one file was exported. */
  zip?: Uint8Array;
}

export interface BuildJpgExportOptions {
  /** One `RenderSlideInput` per slide, in Sunday Flow (export) order. */
  slides: RenderSlideInput[];
  /** Output filenames, same length and order as `slides` — see `buildExportFilenames`. */
  filenames: string[];
  onProgress?: (done: number, total: number) => void;
}

export async function buildJpgExport({ slides, filenames, onProgress }: BuildJpgExportOptions): Promise<JpgExportResult> {
  if (slides.length !== filenames.length) {
    throw new Error(
      `buildJpgExport: slides (${slides.length}) and filenames (${filenames.length}) must be the same length`,
    );
  }
  if (slides.length === 0) {
    return { files: [] };
  }

  // Section 34 of BUILD_HANDOFF.md: exports always render with the safe-zone guide off,
  // regardless of what the caller's editor preview was showing.
  const exportInputs = slides.map((slide) => ({ ...slide, showSafeZone: false }));
  const rendered = await renderSlidesToJpegs(exportInputs, onProgress);

  const blockedSlideIds = rendered.filter((r) => !r.fit.exportable).map((r) => r.fit.slideId);
  if (blockedSlideIds.length > 0) {
    throw new JpgExportBlockedError(blockedSlideIds);
  }

  const files: JpgExportFile[] = rendered.map((r, index) => ({ name: filenames[index], bytes: r.jpeg }));

  if (files.length <= 1) {
    return { files };
  }

  const zip = new JSZip();
  for (const file of files) zip.file(file.name, file.bytes);
  const zipBytes = await zip.generateAsync({ type: "uint8array" });
  return { files, zip: zipBytes };
}
