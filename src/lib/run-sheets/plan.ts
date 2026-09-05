/**
 * Pure run-sheet → Sunday Flow planner (sections 15/18/19/38 of
 * BUILD_HANDOFF.md). Turns a validated `ParsedRunSheet` plus the current
 * mappings/templates/structural defaults/existing deck into a plan of
 * inserts/updates/deletes. No I/O, no database access — a later integration
 * step applies this plan through the data layer.
 */

import type {
  AnnouncementMapping,
  DefaultStructuralSlide,
  ParsedAnnouncement,
  ParsedRunSheet,
  Slide,
  SlideContent,
  SlideStatus,
  StructuralSortZone,
  Template,
} from "@/lib/domain/types";
import { matchAnnouncement, type MatchResult } from "@/lib/mappings/matcher";
import { normalizeText, similarity } from "@/lib/engines/textNormalize";
import { orderSlides, planStructuralSlides } from "@/lib/engines/structuralInsert";

/** Confidence at/above which a matched announcement is auto-approved (no reviewReasons). */
export const READY_CONFIDENCE_THRESHOLD = 0.8;

/** Below this similarity, a manually-edited slide's underlying source text is considered materially changed. */
export const SOURCE_CHANGE_SIMILARITY_THRESHOLD = 0.9;

export type PlanMode = "replace" | "merge";

export interface NewSlide {
  headline: string;
  content: SlideContent;
  templateId: string;
  mappingId: string | null;
  status: SlideStatus;
  parserConfidence: number | null;
  sourceAnnouncement: ParsedAnnouncement | null;
  isStructural: boolean;
  structuralDefaultId: string | null;
  includeInVideo: boolean;
  sortOrder: number;
}

export interface SlideUpdate {
  id: string;
  patch: Partial<Slide>;
}

export interface PlanApplyInput {
  parsed: ParsedRunSheet;
  mappings: AnnouncementMapping[];
  templates: Template[];
  structuralDefaults: DefaultStructuralSlide[];
  existingSlides: Slide[];
  mode: PlanMode;
  /** Fallback template for announcements that don't match any mapping. */
  defaultTemplateId: string;
}

export interface PlanApplyResult {
  inserts: NewSlide[];
  updates: SlideUpdate[];
  deletes: string[];
  /** Headlines of unmatched announcements, surfaced for an admin/Sunday-team "remember this mapping" prompt. */
  suggestions: string[];
  summary: { found: number; mapped: number; needsReview: number };
}

// --- Shared per-announcement analysis ---------------------------------------------------------

type NewSlideDraft = Omit<NewSlide, "sortOrder">;

interface AnalyzedAnnouncement {
  announcement: ParsedAnnouncement;
  match: MatchResult | null;
  draft: NewSlideDraft;
  unmatched: boolean;
  needsReview: boolean;
}

function flattenAnnouncements(parsed: ParsedRunSheet): ParsedAnnouncement[] {
  const flattened: ParsedAnnouncement[] = [];
  for (const section of parsed.sections) {
    const inSection = [...section.announcements].sort((a, b) => a.sourceOrder - b.sourceOrder);
    flattened.push(...inSection);
  }
  return flattened;
}

function buildContent(announcement: ParsedAnnouncement): SlideContent {
  return {
    headline: announcement.headline,
    line1: announcement.line1 ?? "",
    line2: announcement.line2 ?? "",
  };
}

function analyzeAnnouncement(
  announcement: ParsedAnnouncement,
  mappings: AnnouncementMapping[],
  templates: Template[],
  defaultTemplateId: string,
): AnalyzedAnnouncement {
  const match = matchAnnouncement(
    { headline: announcement.headline, sourceText: announcement.sourceText, canonicalKey: announcement.canonicalKey },
    mappings,
  );

  const matchedTemplate = match ? templates.find((t) => t.id === match.mapping.templateId) : undefined;
  const resolvedTemplate = matchedTemplate ?? templates.find((t) => t.id === defaultTemplateId);
  const resolvedTemplateId = resolvedTemplate?.id ?? defaultTemplateId;

  const unmatched = match === null;
  const parserConfidence = match ? Math.min(announcement.confidence, match.confidence) : announcement.confidence;
  const hasReviewReasons = announcement.reviewReasons.length > 0;
  const status: SlideStatus =
    !unmatched && parserConfidence >= READY_CONFIDENCE_THRESHOLD && !hasReviewReasons ? "ready" : "needs_review";

  const draft: NewSlideDraft = {
    headline: announcement.headline,
    content: buildContent(announcement),
    templateId: resolvedTemplateId,
    mappingId: match?.mapping.id ?? null,
    status,
    parserConfidence,
    sourceAnnouncement: announcement,
    isStructural: false,
    structuralDefaultId: null,
    includeInVideo: resolvedTemplate?.includeInVideoDefault ?? false,
  };

  return { announcement, match, draft, unmatched, needsReview: status === "needs_review" };
}

function buildStructuralDraft(def: DefaultStructuralSlide): NewSlideDraft {
  return {
    headline: def.defaultContent.headline ?? def.nameEn,
    content: def.defaultContent,
    templateId: def.templateId,
    mappingId: null,
    status: "ready",
    parserConfidence: null,
    sourceAnnouncement: null,
    isStructural: true,
    structuralDefaultId: def.id,
    includeInVideo: def.includeInVideoDefault,
  };
}

function summarize(analyzed: AnalyzedAnnouncement[]): PlanApplyResult["summary"] {
  return {
    found: analyzed.length,
    mapped: analyzed.filter((a) => !a.unmatched).length,
    needsReview: analyzed.filter((a) => a.needsReview).length,
  };
}

type ZonedDraft = NewSlideDraft & { zone: StructuralSortZone; sortOrder: number };

function omitZone(entry: ZonedDraft): NewSlideDraft & { sortOrder: number } {
  const rest: Partial<ZonedDraft> = { ...entry };
  delete rest.zone;
  return rest as NewSlideDraft & { sortOrder: number };
}

function hasZone(entry: unknown): entry is ZonedDraft {
  return typeof entry === "object" && entry !== null && "zone" in entry;
}

function hasId(entry: unknown): entry is Slide {
  return typeof entry === "object" && entry !== null && "id" in entry;
}

/**
 * Entry point: plans the slide changes needed to apply a parsed run sheet to
 * a Sunday, in either `replace` (wipe + regenerate everything) or `merge`
 * (preserve manual edits, update generated content, add/remove as needed)
 * mode.
 */
export function planApply(input: PlanApplyInput): PlanApplyResult {
  const { parsed, mappings, templates, structuralDefaults, existingSlides, mode, defaultTemplateId } = input;

  const analyzed = flattenAnnouncements(parsed).map((announcement) =>
    analyzeAnnouncement(announcement, mappings, templates, defaultTemplateId),
  );

  return mode === "replace"
    ? planReplace(analyzed, structuralDefaults, existingSlides)
    : planMerge(analyzed, structuralDefaults, existingSlides);
}

// --- Replace mode ------------------------------------------------------------------------------

function planReplace(
  analyzed: AnalyzedAnnouncement[],
  structuralDefaults: DefaultStructuralSlide[],
  existingSlides: Slide[],
): PlanApplyResult {
  const announcementDrafts = analyzed.map((a) => a.draft);

  const { toInsert } = planStructuralSlides(structuralDefaults, []);
  const structuralDrafts: ZonedDraft[] = toInsert.map(({ default: def, zone }) => ({
    ...buildStructuralDraft(def),
    zone,
    sortOrder: def.sortOrder,
  }));

  const ordered = orderSlides(announcementDrafts, structuralDrafts);
  const inserts: NewSlide[] = ordered.map((entry, index) => {
    if (hasZone(entry)) {
      return { ...omitZone(entry), sortOrder: index };
    }
    return { ...entry, sortOrder: index };
  });

  const suggestions = analyzed.filter((a) => a.unmatched).map((a) => a.announcement.headline);
  const deletes = existingSlides.map((s) => s.id);

  return { inserts, updates: [], deletes, suggestions, summary: summarize(analyzed) };
}

// --- Merge mode ----------------------------------------------------------------------------------

function findExistingMatch(
  candidates: Slide[],
  consumed: Set<string>,
  match: MatchResult | null,
  announcement: ParsedAnnouncement,
): Slide | undefined {
  const available = candidates.filter((slide) => !consumed.has(slide.id));

  if (match) {
    const byMapping = available.find((slide) => slide.mappingId === match.mapping.id);
    if (byMapping) return byMapping;
  }

  const normalizedHeadline = normalizeText(announcement.headline);
  return available.find((slide) => normalizeText(slide.headline) === normalizedHeadline);
}

function diffGeneratedSlide(existing: Slide, draft: NewSlideDraft): Partial<Slide> | null {
  const patch: Partial<Slide> = {};
  if (existing.headline !== draft.headline) patch.headline = draft.headline;
  if (JSON.stringify(existing.content) !== JSON.stringify(draft.content)) patch.content = draft.content;
  if (existing.templateId !== draft.templateId) patch.templateId = draft.templateId;
  if (existing.mappingId !== draft.mappingId) patch.mappingId = draft.mappingId;
  if (existing.status !== draft.status) patch.status = draft.status;
  if (existing.parserConfidence !== draft.parserConfidence) patch.parserConfidence = draft.parserConfidence;
  if (existing.includeInVideo !== draft.includeInVideo) patch.includeInVideo = draft.includeInVideo;
  if (JSON.stringify(existing.sourceAnnouncement) !== JSON.stringify(draft.sourceAnnouncement)) {
    patch.sourceAnnouncement = draft.sourceAnnouncement;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

function upsertPatch(updates: SlideUpdate[], id: string, patch: Partial<Slide>): void {
  const existingEntry = updates.find((u) => u.id === id);
  if (existingEntry) {
    existingEntry.patch = { ...existingEntry.patch, ...patch };
  } else {
    updates.push({ id, patch });
  }
}

function planMerge(
  analyzed: AnalyzedAnnouncement[],
  structuralDefaults: DefaultStructuralSlide[],
  existingSlides: Slide[],
): PlanApplyResult {
  const existingAnnouncementSlides = existingSlides.filter((s) => !s.isStructural);
  const existingStructuralSlides = existingSlides.filter((s) => s.isStructural);
  const generatedCandidates = existingAnnouncementSlides.filter((s) => s.sourceAnnouncement !== null);

  const consumed = new Set<string>();
  const updates: SlideUpdate[] = [];
  const newInserts: NewSlideDraft[] = [];
  const suggestions: string[] = [];

  for (const item of analyzed) {
    const { announcement, match, draft, unmatched } = item;
    const existingMatch = findExistingMatch(generatedCandidates, consumed, match, announcement);

    if (existingMatch) {
      consumed.add(existingMatch.id);
      if (unmatched) suggestions.push(announcement.headline);

      if (existingMatch.manuallyEdited) {
        const previousSourceText = existingMatch.sourceAnnouncement?.sourceText ?? "";
        const changeSimilarity = similarity(
          normalizeText(previousSourceText),
          normalizeText(announcement.sourceText),
        );
        if (changeSimilarity < SOURCE_CHANGE_SIMILARITY_THRESHOLD) {
          upsertPatch(updates, existingMatch.id, {
            status: "needs_review",
            sourceAnnouncement: {
              ...announcement,
              reviewReasons: Array.from(new Set([...announcement.reviewReasons, "source_changed"])),
            },
          });
        }
        // Similarity is high enough: leave this manually-edited slide fully untouched.
      } else {
        const patch = diffGeneratedSlide(existingMatch, draft);
        if (patch) upsertPatch(updates, existingMatch.id, patch);
      }
    } else {
      newInserts.push(draft);
      if (unmatched) suggestions.push(announcement.headline);
    }
  }

  // Generated (non-manual) announcement slides that vanished from this week's sheet are removed.
  const deletes = generatedCandidates.filter((s) => !consumed.has(s.id)).map((s) => s.id);
  const deletedIds = new Set(deletes);

  const keptAnnouncementSlides = existingAnnouncementSlides.filter((s) => !deletedIds.has(s.id));
  const orderedKept = [...keptAnnouncementSlides].sort((a, b) => a.sortOrder - b.sortOrder);
  const announcementBucket: (Slide | NewSlideDraft)[] = [...orderedKept, ...newInserts];

  const { toInsert } = planStructuralSlides(structuralDefaults, existingSlides);
  const newStructuralZoned: ZonedDraft[] = toInsert.map(({ default: def, zone }) => ({
    ...buildStructuralDraft(def),
    zone,
    sortOrder: def.sortOrder,
  }));
  const existingStructuralZoned: (Slide & { zone: StructuralSortZone })[] = existingStructuralSlides.map((s) => ({
    ...s,
    zone: structuralDefaults.find((d) => d.id === s.structuralDefaultId)?.defaultSortZone ?? "before_announcements",
  }));

  const ordered = orderSlides(announcementBucket, [...existingStructuralZoned, ...newStructuralZoned]);

  const inserts: NewSlide[] = [];
  ordered.forEach((entry, index) => {
    if (hasId(entry)) {
      if (entry.sortOrder !== index) {
        upsertPatch(updates, entry.id, { sortOrder: index });
      }
      return;
    }
    if (hasZone(entry)) {
      inserts.push({ ...omitZone(entry), sortOrder: index });
      return;
    }
    inserts.push({ ...entry, sortOrder: index });
  });

  return { inserts, updates, deletes, suggestions, summary: summarize(analyzed) };
}
