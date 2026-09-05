"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/data";
import { duplicateSlide, rememberMapping } from "@/lib/sunday/slides";
import type { Slide, SlideBackgroundMode, SlideContent, SlideStatus } from "@/lib/domain/types";

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
  /** Present when the user checked "Remember this template for …" on save. */
  rememberMappingTemplateId?: string;
}

/** Saves the Slide Editor's content — this is the human confirmation that clears `needs_review`. */
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

  revalidatePath(`/sunday/${date}/flow`);
  revalidatePath(`/sunday/${date}`);
  return slide;
}

export async function duplicateSlideAction(slideId: string, date: string): Promise<Slide> {
  const slide = await duplicateSlide(slideId);
  revalidatePath(`/sunday/${date}/flow`);
  return slide;
}
