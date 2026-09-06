import "server-only";

/**
 * Read-only view-model helpers for the Sunday-team screens. Every function here is a
 * thin, side-effect-free wrapper around `getDb()` / `@/lib/r2` — screens/actions should
 * prefer these over reaching into the repository or R2 client directly for the same
 * small pieces of derived data.
 */
import { getDb } from "@/lib/data";
import { isMockMode } from "@/lib/env";
import { mockAssetUrl } from "@/lib/data/mockSeed";
import { getSignedReadUrl } from "@/lib/r2/client";
import type { Asset, Slide, Template } from "@/lib/domain/types";
import type { ResolvedAsset } from "@/lib/renderer/types";

/** Absolute URL for an asset's image — a mock data: URI in mock mode, else a signed R2 read URL. */
export async function resolveAssetUrl(asset: Asset): Promise<string> {
  if (isMockMode()) return mockAssetUrl(asset);
  return getSignedReadUrl(asset.r2Key);
}

/**
 * Resolves a batch of asset ids (deduplicated, nullish entries ignored) into
 * `{ asset, url }` pairs ready for `RenderSlideInput.assets` — used to render real
 * template thumbnails/previews across the dashboard, flow, add-slide and editor screens.
 */
export async function resolveAssetsByIds(ids: (string | null | undefined)[]): Promise<ResolvedAsset[]> {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  if (uniqueIds.length === 0) return [];

  const db = getDb();
  const resolved = await Promise.all(
    uniqueIds.map(async (id): Promise<ResolvedAsset | null> => {
      const asset = await db.getAsset(id);
      if (!asset) return null;
      const url = await resolveAssetUrl(asset);
      return { asset, url };
    }),
  );
  return resolved.filter((entry): entry is ResolvedAsset => entry !== null);
}

/**
 * Every asset id a `SlidePreview` render of these slides might need: each slide's own
 * `assetId`, plus each referenced template's default background image (the generic
 * renderer falls back to it when a slide has no `assetId` of its own).
 */
export function collectBackgroundAssetIds(
  slides: Pick<Slide, "assetId" | "templateId">[],
  templatesById: Record<string, Pick<Template, "backgroundType" | "backgroundValue">>,
): string[] {
  const ids = new Set<string>();
  for (const slide of slides) {
    if (slide.assetId) ids.add(slide.assetId);
    const template = templatesById[slide.templateId];
    if (template?.backgroundType === "image") ids.add(template.backgroundValue);
  }
  return Array.from(ids);
}

export function buildTemplatesById(templates: Template[]): Record<string, Template> {
  return Object.fromEntries(templates.map((t) => [t.id, t]));
}

export function buildColorHexById(colors: { id: string; hex: string }[]): Record<string, string> {
  return Object.fromEntries(colors.map((c) => [c.id, c.hex]));
}

// ---------------------------------------------------------------------------
// Simplified Sunday IA — 3-step stepper (see design/figma/screens.md).
// ---------------------------------------------------------------------------

export type StepperRunSheetState = "used" | "new" | "none";
export type StepperCheckState = "allGood" | "toCheck" | "empty";
export type StepperDownloadState = "ready" | "blocked" | "empty";

export interface SundayStepperData {
  runSheet: { state: StepperRunSheetState; file: string | null };
  check: { state: StepperCheckState; count: number };
  download: { state: StepperDownloadState; count: number };
  /** A later Sunday with slides or a fresh (not-yet-used) run sheet — offered as "Switch to …". */
  switchTo: { date: string } | null;
}

/** Everything the `SundayStepper` header needs for one Sunday, in one round trip. */
export async function buildSundayStepperData(sundayId: string, date: string): Promise<SundayStepperData> {
  const db = getDb();
  const [slides, runSheet, sundays] = await Promise.all([
    db.listSlidesForSunday(sundayId),
    db.getLatestRunSheetForSunday(sundayId),
    db.listSundays(),
  ]);

  const runSheetData: SundayStepperData["runSheet"] = !runSheet
    ? { state: "none", file: null }
    : { state: runSheet.parseStatus === "added_to_flow" ? "used" : "new", file: runSheet.originalFilename };

  const attention = slides.filter((s) => s.status === "needs_review" || s.status === "invalid").length;
  const checkData: SundayStepperData["check"] =
    slides.length === 0 ? { state: "empty", count: 0 } : { state: attention > 0 ? "toCheck" : "allGood", count: attention };

  const invalid = slides.filter((s) => s.status === "invalid").length;
  const downloadData: SundayStepperData["download"] =
    slides.length === 0 ? { state: "empty", count: 0 } : { state: invalid > 0 ? "blocked" : "ready", count: invalid };

  const later = sundays.find(
    (s) =>
      s.serviceDate > date &&
      (s.slideCounts.total > 0 || (s.latestRunSheet !== null && s.latestRunSheet.parseStatus !== "added_to_flow")),
  );

  return {
    runSheet: runSheetData,
    check: checkData,
    download: downloadData,
    switchTo: later ? { date: later.serviceDate } : null,
  };
}
