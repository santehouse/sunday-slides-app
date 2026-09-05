"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createSlideFromTemplate } from "@/lib/sunday/slides";

/** Creates a slide from `templateId` and sends the Sunday team straight to its editor. */
export async function addSlideAction(sundayId: string, date: string, templateId: string): Promise<never> {
  const slide = await createSlideFromTemplate(sundayId, templateId);
  revalidatePath(`/sunday/${date}/flow`);
  revalidatePath(`/sunday/${date}`);
  const locale = await getLocale();
  return redirect({ href: `/sunday/${date}/slide/${slide.id}`, locale });
}
