"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/data";
import { removeSlide } from "@/lib/sunday/slides";

type RemoveSlideResult = Awaited<ReturnType<typeof removeSlide>>;

/** Persists the Sunday Flow order after a drag/keyboard reorder (section 7 of BUILD_HANDOFF.md). */
export async function reorderSlidesAction(sundayId: string, date: string, orderedIds: string[]): Promise<void> {
  await getDb().reorderSlides(sundayId, orderedIds);
  revalidatePath(`/sunday/${date}/flow`);
  revalidatePath(`/sunday/${date}`);
}

/** Removes a slide from the flow, unless it's a non-removable structural slide. */
export async function removeSlideAction(slideId: string, date: string): Promise<RemoveSlideResult> {
  const result = await removeSlide(slideId);
  if (result.ok) {
    revalidatePath(`/sunday/${date}/flow`);
    revalidatePath(`/sunday/${date}`);
  }
  return result;
}
