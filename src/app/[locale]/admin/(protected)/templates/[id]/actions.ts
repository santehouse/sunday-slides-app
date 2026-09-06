"use server";

import { revalidatePath } from "next/cache";
import { getDb, type CreateTemplateFieldInput, type UpdateTemplatePatch } from "@/lib/data";
import type { TemplateWithFields } from "@/lib/data";
import type { SafeZone } from "@/lib/domain/types";

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

export type UpdateSafeZoneResult = { ok: true; safeZone: SafeZone } | { ok: false; error: string };

/**
 * Persists the global broadcast safe zone (BUILD_HANDOFF §13) — dragged/resized on the
 * Template Studio canvas, applied to every template + the Sunday Flow preview at once.
 * The Settings page's numeric fields read from the same `AppSettings.safeZone` row.
 */
export async function updateSafeZoneAction(safeZone: SafeZone): Promise<UpdateSafeZoneResult> {
  const db = getDb();
  try {
    const settings = await db.updateSettings({ safeZone });
    revalidatePath("/admin/settings");
    revalidatePath("/admin/templates");
    return { ok: true, safeZone: settings.safeZone };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "unknown" };
  }
}
