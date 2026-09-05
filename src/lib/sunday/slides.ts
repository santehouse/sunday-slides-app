import "server-only";

/**
 * Sunday Flow slide operations that don't belong to the run-sheet pipeline
 * (sections 11/14/18 of BUILD_HANDOFF.md): Add Slide, Duplicate, "Remember
 * this mapping", and slide removal (with the structural-slide guard).
 */
import { getDb, normalizeAlias } from "@/lib/data";
import type { Slide, SlideBackgroundMode, SlideContent, SlideStatus } from "@/lib/domain/types";

export type RemoveSlideResult = { ok: true } | { ok: false; error: "not_removable" };

/**
 * Creates a new, blank slide from a Published template at the end of the
 * Sunday Flow. Every team-editable field (other than headline, which lives
 * on `slide.headline`) starts as an empty string; the slide is `invalid`
 * until any required field is filled in (or immediately `ready` when the
 * template has no required fields at all).
 */
export async function createSlideFromTemplate(sundayId: string, templateId: string): Promise<Slide> {
  const db = getDb();
  const template = await db.getTemplate(templateId);
  if (!template) {
    throw new Error(`createSlideFromTemplate: template ${templateId} not found`);
  }

  const content: SlideContent = {};
  for (const field of template.fields) {
    if (field.teamEditable && field.fieldKey !== "headline") content[field.fieldKey] = "";
  }

  const status: SlideStatus = template.fields.some((f) => f.required) ? "invalid" : "ready";

  const backgroundMode: SlideBackgroundMode = template.backgroundType === "color" ? "color" : "image";
  let approvedColorId: string | null = null;
  let assetId: string | null = null;
  if (backgroundMode === "color") {
    const enabledColors = await db.listApprovedColors({ enabledOnly: true });
    approvedColorId = enabledColors[0]?.id ?? null;
  } else {
    assetId = template.backgroundValue;
  }

  return db.createSlide({
    sundayId,
    templateId,
    headline: "",
    content,
    assetId,
    backgroundMode,
    approvedColorId,
    includeInVideo: template.includeInVideoDefault,
    status,
    isStructural: false,
    structuralDefaultId: null,
    parserConfidence: null,
    mappingId: null,
    sourceAnnouncement: null,
    manuallyEdited: true,
  });
}

/** Inserts a copy of `slideId` immediately after it in Sunday Flow order and renumbers the deck. */
export async function duplicateSlide(slideId: string): Promise<Slide> {
  const db = getDb();
  const original = await db.getSlide(slideId);
  if (!original) {
    throw new Error(`duplicateSlide: slide ${slideId} not found`);
  }

  const siblings = (await db.listSlidesForSunday(original.sundayId)).sort((a, b) => a.sortOrder - b.sortOrder);
  const originalIndex = siblings.findIndex((s) => s.id === slideId);

  const created = await db.createSlide({
    sundayId: original.sundayId,
    templateId: original.templateId,
    headline: original.headline,
    content: { ...original.content },
    assetId: original.assetId,
    backgroundMode: original.backgroundMode,
    approvedColorId: original.approvedColorId,
    includeInVideo: original.includeInVideo,
    status: original.status,
    // A duplicate is always a plain, removable slide — never counted as the structural original.
    isStructural: false,
    structuralDefaultId: null,
    parserConfidence: null,
    mappingId: original.mappingId,
    sourceAnnouncement: null,
    manuallyEdited: true,
  });

  const orderedIds = siblings.map((s) => s.id);
  orderedIds.splice(originalIndex + 1, 0, created.id);
  const reordered = await db.reorderSlides(original.sundayId, orderedIds);
  return reordered.find((s) => s.id === created.id) ?? created;
}

/**
 * Writes a reusable announcement mapping/alias after an explicit Sunday
 * Team action (section 18: "Remember this mapping" — never learned
 * silently). No-ops the mapping-learning part when the slide has no
 * `sourceAnnouncement` (a manually added slide) — the template switch still
 * happens.
 */
export async function rememberMapping(slideId: string, templateId: string): Promise<void> {
  const db = getDb();
  const slide = await db.getSlide(slideId);
  if (!slide) {
    throw new Error(`rememberMapping: slide ${slideId} not found`);
  }

  if (!slide.sourceAnnouncement) {
    await db.updateSlide(slideId, { templateId, manuallyEdited: true });
    return;
  }

  const headline = slide.sourceAnnouncement.headline;
  const normalizedHeadline = normalizeAlias(headline);

  const mappings = await db.listMappings();
  const existing = mappings.find(
    (m) =>
      normalizeAlias(m.canonicalName) === normalizedHeadline ||
      m.aliases.some((a) => normalizeAlias(a.alias) === normalizedHeadline),
  );

  let mappingId: string;
  if (existing) {
    if (existing.templateId !== templateId) {
      await db.updateMapping(existing.id, { templateId });
    }
    const alreadyHasAlias =
      normalizeAlias(existing.canonicalName) === normalizedHeadline ||
      existing.aliases.some((a) => normalizeAlias(a.alias) === normalizedHeadline);
    if (!alreadyHasAlias) {
      await db.addAlias(existing.id, headline);
    }
    mappingId = existing.id;
  } else {
    const created = await db.createMapping({ canonicalName: headline, templateId, aliases: [] });
    mappingId = created.id;
  }

  await db.updateSlide(slideId, { templateId, mappingId, manuallyEdited: true });

  const suggestions = await db.listMappingSuggestions();
  const matchingSuggestion = suggestions.find((s) => s.sourceTextNormalized === normalizedHeadline);
  if (matchingSuggestion) {
    await db.dismissMappingSuggestion(matchingSuggestion.id);
  }
}

/**
 * Removes a slide, refusing when it's a structural slide whose default is
 * `insertionRule: "always"` or `removableBySundayTeam: false` (section 19).
 * Renumbers the remaining deck (contiguous `sortOrder`) on success.
 */
export async function removeSlide(slideId: string): Promise<RemoveSlideResult> {
  const db = getDb();
  const slide = await db.getSlide(slideId);
  if (!slide) {
    return { ok: false, error: "not_removable" };
  }

  if (slide.isStructural) {
    const defaults = await db.listStructuralDefaults();
    const def = slide.structuralDefaultId ? defaults.find((d) => d.id === slide.structuralDefaultId) : undefined;
    const blocked = def ? def.insertionRule === "always" || !def.removableBySundayTeam : true;
    if (blocked) {
      return { ok: false, error: "not_removable" };
    }
  }

  await db.deleteSlide(slideId);
  const remaining = await db.listSlidesForSunday(slide.sundayId);
  await db.reorderSlides(
    slide.sundayId,
    remaining.map((s) => s.id),
  );
  return { ok: true };
}
