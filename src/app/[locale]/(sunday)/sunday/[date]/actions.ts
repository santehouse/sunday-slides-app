"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/data";
import { createSlideFromTemplate, duplicateSlide, removeSlide, rememberMapping } from "@/lib/sunday/slides";
import type { Slide, SlideBackgroundMode, SlideContent, SlideStatus } from "@/lib/domain/types";

type RemoveSlideResult = Awaited<ReturnType<typeof removeSlide>>;

function revalidateSunday(date: string): void {
  revalidatePath(`/sunday/${date}`);
  revalidatePath(`/sunday/${date}/run-sheet`);
  revalidatePath(`/sunday/${date}/download`);
}

/** Persists the Sunday Flow order after a drag/keyboard reorder (section 7 of BUILD_HANDOFF.md). */
export async function reorderSlidesAction(sundayId: string, date: string, orderedIds: string[]): Promise<void> {
  await getDb().reorderSlides(sundayId, orderedIds);
  revalidateSunday(date);
}

/** Removes a slide from the flow, unless it's a non-removable structural slide. */
export async function removeSlideAction(slideId: string, date: string): Promise<RemoveSlideResult> {
  const result = await removeSlide(slideId);
  if (result.ok) revalidateSunday(date);
  return result;
}

export interface SaveSlideInput {
  templateId: string;
  headline: string;
  content: SlideContent;
  backgroundMode: SlideBackgroundMode;
  approvedColorId: string | null;
  assetId: string | null;
  includeInVideo: boolean;
  /** Computed client-side (the browser has the canvas measurer) — "invalid" blocks export. */
  status: SlideStatus;
  /** Present when the user checked "Remember this design for …" on save. */
  rememberMappingTemplateId?: string;
}

/** Saves the slide edit panel's content — this is the human confirmation that clears `needs_review`. */
export async function saveSlideAction(slideId: string, date: string, input: SaveSlideInput): Promise<Slide> {
  const slide = await getDb().updateSlide(slideId, {
    templateId: input.templateId,
    headline: input.headline,
    content: input.content,
    backgroundMode: input.backgroundMode,
    approvedColorId: input.approvedColorId,
    assetId: input.assetId,
    includeInVideo: input.includeInVideo,
    status: input.status,
    manuallyEdited: true,
  });

  if (input.rememberMappingTemplateId) {
    await rememberMapping(slideId, input.rememberMappingTemplateId);
  }

  revalidateSunday(date);
  return slide;
}

export async function duplicateSlideAction(slideId: string, date: string): Promise<Slide> {
  const slide = await duplicateSlide(slideId);
  revalidateSunday(date);
  return slide;
}

export async function createSlideFromTemplateAction(sundayId: string, date: string, templateId: string): Promise<Slide> {
  const slide = await createSlideFromTemplate(sundayId, templateId);
  revalidateSunday(date);
  return slide;
}
