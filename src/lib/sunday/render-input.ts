import "server-only";

/**
 * Builds a `RenderSlideInput` (see `@/lib/renderer/types`) from a stored
 * `Slide` — the one place that resolves a slide's template, approved color,
 * background/team assets, and fonts into the shape the renderer (browser
 * preview, JPG export, MP4 frames, and `/api/render/slide/[slideId]`) needs.
 * Every caller in this codebase should build render input through here so
 * asset/font resolution never drifts between preview and export.
 */
import { getDb } from "@/lib/data";
import { isMockMode } from "@/lib/env";
import { mockAssetUrl } from "@/lib/data/mockSeed";
import { getSignedReadUrl } from "@/lib/r2/client";
import { resolveFonts } from "@/lib/fonts/resolve";
import type { Asset, Slide } from "@/lib/domain/types";
import type { RenderSlideInput, ResolvedAsset } from "@/lib/renderer/types";

export interface BuildRenderInputOptions {
  showSafeZone?: boolean;
  safeZoneLabel?: string;
}

async function resolveAssetUrl(asset: Asset): Promise<string> {
  if (isMockMode()) return mockAssetUrl({ nameEn: asset.nameEn });
  return getSignedReadUrl(asset.r2Key);
}

/**
 * Resolves every distinct `Asset` a slide's render might need: the slide's
 * own `assetId` (team-chosen background image) and, in case it's needed as
 * a fallback, the template's own background asset (when the template's
 * default background is an image). Missing/deleted asset ids are skipped
 * rather than thrown — the renderer just falls back to a solid color.
 */
async function resolveAssets(assetIds: (string | null)[]): Promise<ResolvedAsset[]> {
  const db = getDb();
  const uniqueIds = Array.from(new Set(assetIds.filter((id): id is string => Boolean(id))));
  const resolved: ResolvedAsset[] = [];
  for (const id of uniqueIds) {
    const asset = await db.getAsset(id);
    if (!asset) continue;
    resolved.push({ asset, url: await resolveAssetUrl(asset) });
  }
  return resolved;
}

/**
 * Builds the full render input for `slide`: its (fielded) template, the
 * effective background color hex, resolved background assets, resolved
 * fonts, and the global broadcast safe zone. Throws if the slide's template
 * no longer exists.
 */
export async function buildRenderInput(slide: Slide, opts: BuildRenderInputOptions = {}): Promise<RenderSlideInput> {
  const db = getDb();

  const template = await db.getTemplate(slide.templateId);
  if (!template) {
    throw new Error(`buildRenderInput: template ${slide.templateId} not found for slide ${slide.id}`);
  }

  let backgroundColorHex: string | null = null;
  if (slide.approvedColorId) {
    const colors = await db.listApprovedColors();
    backgroundColorHex = colors.find((c) => c.id === slide.approvedColorId)?.hex ?? null;
  }
  if (!backgroundColorHex && template.backgroundType === "color") {
    backgroundColorHex = template.backgroundValue;
  }

  const templateBackgroundAssetId = template.backgroundType === "image" ? template.backgroundValue : null;
  const assets = await resolveAssets([slide.assetId, templateBackgroundAssetId]);

  const families = Array.from(new Set(template.fields.map((f) => f.fontFamily)));
  const fontRecords = await db.listFonts();
  const fonts = await resolveFonts(fontRecords, families);

  const settings = await db.getSettings();

  return {
    template,
    slide,
    backgroundColorHex,
    assets,
    fonts,
    safeZone: settings.safeZone,
    showSafeZone: opts.showSafeZone ?? false,
    safeZoneLabel: opts.safeZoneLabel,
  };
}
