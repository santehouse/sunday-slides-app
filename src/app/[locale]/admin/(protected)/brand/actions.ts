"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb, FontInUseError } from "@/lib/data";
import { putObject, keys } from "@/lib/r2/client";
import type { FontRecord, FontStyle } from "@/lib/domain/types";
import type { UpdateSettingsPatch, UpsertApprovedColorInput } from "@/lib/data";

function revalidateBrand() {
  revalidatePath("/admin/brand");
  revalidatePath("/admin");
}

export async function setFontFamilyEnabledAction(ids: string[], enabled: boolean): Promise<{ ok: boolean }> {
  const db = getDb();
  await Promise.all(ids.map((id) => db.updateFont(id, { enabled })));
  revalidateBrand();
  return { ok: true };
}

export type DeleteFontFamilyResult = { ok: true } | { ok: false; error: "in_use"; templateNames: string[] };

export async function deleteFontFamilyAction(ids: string[]): Promise<DeleteFontFamilyResult> {
  const db = getDb();
  for (const id of ids) {
    try {
      await db.deleteFont(id);
    } catch (error) {
      if (error instanceof FontInUseError) {
        return { ok: false, error: "in_use", templateNames: error.templateNames };
      }
      throw error;
    }
  }
  revalidateBrand();
  return { ok: true };
}

export async function enableGoogleFontAction(
  family: string,
  weights: number[],
  italic: boolean,
): Promise<{ ok: boolean; fonts?: FontRecord[] }> {
  const db = getDb();
  const styles: FontStyle[] = italic ? ["normal", "italic"] : ["normal"];
  const created = await Promise.all(
    weights.flatMap((weight) =>
      styles.map((style) =>
        db.createFont({ family, source: "google", sourceIdentifier: family, weight, style, enabled: true }),
      ),
    ),
  );
  revalidateBrand();
  return { ok: true, fonts: created };
}

const FONT_MIME_EXT: Record<string, string> = {
  "font/woff": "woff",
  "font/woff2": "woff2",
  "application/font-woff": "woff",
  "application/font-woff2": "woff2",
  "font/ttf": "ttf",
  "font/otf": "otf",
  "application/x-font-ttf": "ttf",
  "application/x-font-opentype": "otf",
  "font/sfnt": "ttf",
};

export type UploadFontFileResult = { ok: true; r2Key: string } | { ok: false; error: string };

export async function uploadFontFileAction(formData: FormData): Promise<UploadFontFileResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "missing_file" };

  const lower = file.name.toLowerCase();
  const byName = (["woff2", "woff", "ttf", "otf"] as const).find((e) => lower.endsWith(`.${e}`)) ?? null;
  const ext = FONT_MIME_EXT[file.type] ?? byName;
  if (!ext) return { ok: false, error: "unsupported_file" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const id = randomUUID();
  const r2Key = keys.fonts(id, ext);
  const contentType =
    ({ woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", otf: "font/otf" } as Record<string, string>)[ext] ??
    "font/woff2";
  try {
    await putObject(r2Key, bytes, contentType);
  } catch (error) {
    console.error("uploadFontFileAction: storage failed", error);
    return { ok: false, error: "storage_failed" };
  }
  return { ok: true, r2Key };
}

export async function createCustomFontAction(input: {
  family: string;
  weight: number;
  style: FontStyle;
  r2Key: string;
}): Promise<{ ok: true; font: FontRecord } | { ok: false; error: "variant_exists" }> {
  const db = getDb();
  // One record per (family, weight, style) — the database enforces it, but a clear
  // answer beats a constraint error: the admin picks another weight/style or deletes
  // the existing variant first. Nothing is ever silently replaced.
  const existing = (await db.listFonts()).find(
    (f) => f.family.trim().toLowerCase() === input.family.trim().toLowerCase() && f.weight === input.weight && f.style === input.style,
  );
  if (existing) return { ok: false, error: "variant_exists" };
  const font = await db.createFont({
    family: input.family.trim(),
    source: "custom",
    r2Key: input.r2Key,
    weight: input.weight,
    style: input.style,
    enabled: true,
  });
  revalidateBrand();
  return { ok: true, font };
}

export async function saveChurchNameAction(churchName: string): Promise<{ ok: boolean }> {
  const db = getDb();
  await db.updateSettings({ churchName } satisfies UpdateSettingsPatch);
  revalidateBrand();
  return { ok: true };
}

export async function upsertApprovedColorAction(input: UpsertApprovedColorInput): Promise<{ ok: boolean }> {
  const db = getDb();
  await db.upsertApprovedColor(input);
  revalidateBrand();
  return { ok: true };
}

export async function deleteApprovedColorAction(id: string): Promise<{ ok: boolean }> {
  const db = getDb();
  await db.deleteApprovedColor(id);
  revalidateBrand();
  return { ok: true };
}
