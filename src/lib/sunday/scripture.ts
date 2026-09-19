import "server-only";
import { getDb } from "@/lib/data";
import type { Slide, SlideContent } from "@/lib/domain/types";
import { formatReference, getVerses, isBibleBookId, type BibleVerse } from "@/lib/bible";
import { stripInlineMarkup } from "@/lib/renderer/engine";

/** Field keys a scripture template is expected to expose (see brandTemplates "scripture-verse"). */
export const SCRIPTURE_FIELD_KEYS = { verse: "verse", reference: "headline" } as const;

export interface ScriptureSlideDraft {
  /** "Hébreux 10:38-39" — the slide headline (card title + export filename). */
  reference: string;
  /** Verse text; several verses per slide are joined with their numbers. */
  text: string;
  verses: number[];
}

/**
 * Groups the chosen verses into slides of `perSlide` verses each. One verse per slide
 * shows bare text (the reference already names it); grouped slides prefix each verse
 * with its number so the reader can follow along.
 */
export function buildScriptureDrafts(
  bookId: string,
  chapter: number,
  verses: readonly BibleVerse[],
  perSlide: number,
): ScriptureSlideDraft[] {
  if (!isBibleBookId(bookId)) return [];
  const size = Math.max(1, Math.min(perSlide, verses.length || 1));
  const drafts: ScriptureSlideDraft[] = [];
  for (let i = 0; i < verses.length; i += size) {
    const group = verses.slice(i, i + size);
    const numbers = group.map((v) => v.verse);
    const text = group.length === 1 ? group[0]!.text : group.map((v) => `${v.verse} ${v.text}`).join("\n");
    drafts.push({ reference: formatReference(bookId, chapter, numbers), text, verses: numbers });
  }
  return drafts;
}

export interface AddScriptureSlidesInput {
  sundayId: string;
  templateId: string;
  bookId: string;
  chapter: number;
  verses: number[];
  perSlide: number;
}

/**
 * Creates one Scriptures-section slide per draft on the chosen template, appended after
 * the section's existing slides. Template fields other than the verse and reference
 * keep their defaults.
 */
export async function addScriptureSlides(input: AddScriptureSlidesInput): Promise<Slide[]> {
  const db = getDb();
  if (!isBibleBookId(input.bookId)) throw new Error(`addScriptureSlides: unknown book ${input.bookId}`);
  const template = await db.getTemplate(input.templateId);
  if (!template) throw new Error(`addScriptureSlides: template ${input.templateId} not found`);
  if (template.category !== "scripture") throw new Error("addScriptureSlides: template is not a scripture template");

  const verses = await getVerses(input.bookId, input.chapter, input.verses);
  const drafts = buildScriptureDrafts(input.bookId, input.chapter, verses, input.perSlide);
  if (drafts.length === 0) return [];

  const existing = await db.listSlidesForSunday(input.sundayId, { section: "scriptures" });
  const enabledColors = template.allowTeamBackgroundChoice ? await db.listApprovedColors({ enabledOnly: true }) : [];
  const backgroundMode = template.backgroundType === "color" ? "color" : "image";
  const approvedColorId = template.allowTeamBackgroundChoice ? (enabledColors[0]?.id ?? null) : null;
  const assetId = template.allowTeamBackgroundChoice ? null : template.backgroundType === "image" ? template.backgroundValue : null;

  const baseContent: SlideContent = {};
  for (const field of template.fields) {
    if (!field.teamEditable || field.fieldKey === "headline") continue;
    baseContent[field.fieldKey] = field.fieldType === "image" ? "" : stripInlineMarkup(field.defaultValue);
  }

  return db.createSlides(
    drafts.map((draft, i) => ({
      sundayId: input.sundayId,
      templateId: template.id,
      section: "scriptures" as const,
      headline: draft.reference,
      content: { ...baseContent, [SCRIPTURE_FIELD_KEYS.verse]: draft.text },
      assetId,
      backgroundMode,
      approvedColorId,
      sortOrder: existing.length + i,
      includeInVideo: false,
      status: "ready" as const,
      isStructural: false,
      structuralDefaultId: null,
      parserConfidence: null,
      mappingId: null,
      sourceAnnouncement: null,
      manuallyEdited: true,
    })),
  );
}
