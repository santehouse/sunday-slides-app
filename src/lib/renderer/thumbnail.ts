import "server-only";

/**
 * Template Studio / Add Slide thumbnails (sections 9 and 14 of BUILD_HANDOFF.md):
 * renders a template with placeholder copy through the exact same server renderer used
 * for real exports, so a thumbnail never lies about how the template actually looks.
 */
import type { Slide, Template } from "@/lib/domain/types";
import { renderSlideToJpeg } from "./server";
import type { RenderSlideInput, ResolvedAsset, ResolvedFont } from "./types";

export interface ThumbnailSampleContent {
  headline?: string;
  [fieldKey: string]: string | undefined;
}

export interface RenderTemplateThumbnailOptions {
  assets?: ResolvedAsset[];
  fonts?: ResolvedFont[];
  /** Overrides the template's own background color resolution (e.g. an admin-picked approved color). */
  backgroundColorHex?: string | null;
}

const PLACEHOLDER_LINE1 = "Mercredi";
const PLACEHOLDER_LINE2 = "19h00 à 20h00";

function buildSampleSlide(template: Template, sampleContent?: ThumbnailSampleContent): Slide {
  const headline = sampleContent?.headline ?? template.nameEn.toUpperCase();
  const content: Record<string, string> = { line1: PLACEHOLDER_LINE1, line2: PLACEHOLDER_LINE2 };
  for (const [key, value] of Object.entries(sampleContent ?? {})) {
    if (key === "headline" || value === undefined) continue;
    content[key] = value;
  }

  const now = new Date().toISOString();
  return {
    id: `thumbnail-${template.id}`,
    sundayId: "thumbnail",
    templateId: template.id,
    headline,
    content,
    assetId: null,
    backgroundMode: template.backgroundType,
    approvedColorId: null,
    sortOrder: 0,
    includeInVideo: false,
    status: "ready",
    isStructural: false,
    structuralDefaultId: null,
    parserConfidence: null,
    mappingId: null,
    sourceAnnouncement: null,
    manuallyEdited: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Renders `template` with placeholder copy — `headline` defaults to the template's
 * English name in caps, `line1`/`line2` default to "Mercredi" / "19h00 à 20h00" — for
 * template thumbnails and Add Slide cards. Never shows the safe-zone guide.
 */
export async function renderTemplateThumbnail(
  template: Template,
  sampleContent?: ThumbnailSampleContent,
  options: RenderTemplateThumbnailOptions = {},
): Promise<Uint8Array> {
  const slide = buildSampleSlide(template, sampleContent);
  const backgroundColorHex =
    options.backgroundColorHex ?? (template.backgroundType === "color" ? template.backgroundValue : null);

  const input: RenderSlideInput = {
    template,
    slide,
    backgroundColorHex,
    assets: options.assets ?? [],
    fonts: options.fonts ?? [],
    showSafeZone: false,
  };

  const rendered = await renderSlideToJpeg(input);
  return rendered.jpeg;
}
