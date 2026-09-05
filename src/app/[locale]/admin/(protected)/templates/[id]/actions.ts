"use server";

import { revalidatePath } from "next/cache";
import { getDb, type CreateTemplateFieldInput, type UpdateTemplatePatch } from "@/lib/data";
import type { TemplateWithFields } from "@/lib/data";

export type SaveTemplateInput = {
  templateId: string;
  patch: UpdateTemplatePatch;
  fields: CreateTemplateFieldInput[];
  allowedAssetIds: string[];
};

export type SaveTemplateResult = { ok: true; template: TemplateWithFields } | { ok: false; error: string };

/** Persists every Studio edit in one action: template metadata, all fields, and allowed assets. */
export async function saveTemplateAction(input: SaveTemplateInput): Promise<SaveTemplateResult> {
  const db = getDb();
  try {
    await db.updateTemplate(input.templateId, input.patch);
    await db.upsertTemplateFields(input.templateId, input.fields);
    await db.setTemplateAssets(input.templateId, input.allowedAssetIds);
    const template = await db.getTemplate(input.templateId);
    if (!template) return { ok: false, error: "not_found" };

    revalidatePath(`/admin/templates/${input.templateId}`);
    revalidatePath("/admin/templates");
    return { ok: true, template };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "unknown" };
  }
}
