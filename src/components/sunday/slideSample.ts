/**
 * Pure helpers that build a fully-shaped `Slide` object for preview purposes only —
 * used wherever a screen needs to render a template with sample or in-progress content
 * through the one real renderer (`SlidePreview`) rather than a hand-drawn placeholder
 * (BUILD_HANDOFF.md section 14: template thumbnails must be actual rendered previews).
 */
import type { Slide, SlideBackgroundMode, SlideContent, SlideStatus, Template } from "@/lib/domain/types";

export type RenderableSlideInit = {
  id?: string;
  templateId: string;
  headline: string;
  content: SlideContent;
  backgroundMode?: SlideBackgroundMode;
  assetId?: string | null;
  status?: SlideStatus;
  includeInVideo?: boolean;
};

/** Fills in every `Slide` field a preview render doesn't care about with a stable default. */
export function makeRenderableSlide(init: RenderableSlideInit): Slide {
  const now = "1970-01-01T00:00:00.000Z";
  return {
    id: init.id ?? "preview",
    sundayId: "preview",
    templateId: init.templateId,
    headline: init.headline,
    content: init.content,
    assetId: init.assetId ?? null,
    backgroundMode: init.backgroundMode ?? "color",
    approvedColorId: null,
    sortOrder: 0,
    includeInVideo: init.includeInVideo ?? true,
    status: init.status ?? "ready",
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
 * Sample content for a template card / Add Slide preview. Figma's template thumbnails
 * (7:128, 8:317) render the template name alone — filling line1/line2 with placeholder
 * copy also leaked English field labels into the FR thumbnails.
 */
export function templateSampleContent(template: Pick<Template, "nameEn" | "nameFr">, locale: "en" | "fr-CA"): SlideContent {
  const name = locale === "fr-CA" ? template.nameFr : template.nameEn;
  return { headline: name.toUpperCase() };
}

/** A renderable sample slide for a template, for use in Add Slide / template pickers. */
export function makeTemplateSampleSlide(template: Template, locale: "en" | "fr-CA"): Slide {
  return makeRenderableSlide({
    templateId: template.id,
    headline: templateSampleContent(template, locale).headline,
    content: templateSampleContent(template, locale),
    backgroundMode: template.backgroundType,
    assetId: template.backgroundType === "image" ? template.backgroundValue : null,
  });
}
