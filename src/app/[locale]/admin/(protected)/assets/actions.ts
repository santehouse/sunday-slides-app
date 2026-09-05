"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/data";
import { putObject, keys } from "@/lib/r2/client";
import { readImageDimensions } from "@/components/admin/imageDimensions";
import type { Asset, AssetCategory } from "@/lib/domain/types";
import type { UpdateAssetPatch } from "@/lib/data";

/** Mirrors the Dropzone's client-side limit — a crafted request must not bypass it. */
const MAX_ASSET_BYTES = 10 * 1024 * 1024;

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type UploadAssetState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; asset: Asset };

export async function uploadAssetAction(formData: FormData): Promise<UploadAssetState> {
  const file = formData.get("file");
  const nameEn = String(formData.get("nameEn") ?? "").trim();
  const category = (String(formData.get("category") ?? "photography") as AssetCategory) ?? "photography";

  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "missing_file" };
  }
  if (file.size > MAX_ASSET_BYTES) {
    return { status: "error", message: "file_too_large" };
  }
  const ext = MIME_EXT[file.type];
  if (!ext) {
    return { status: "error", message: "unsupported_file" };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const dimensions = readImageDimensions(bytes);
  if (!dimensions) {
    return { status: "error", message: "unsupported_file" };
  }

  const id = randomUUID();
  const r2Key = keys.assets(id, ext);
  await putObject(r2Key, bytes, file.type);

  const db = getDb();
  const asset = await db.createAsset({
    nameEn: nameEn || file.name,
    nameFr: nameEn || file.name,
    status: "draft",
    category,
    tags: [],
    r2Key,
    mimeType: file.type,
    width: dimensions.width,
    height: dimensions.height,
  });

  revalidatePath("/admin/assets");
  return { status: "success", asset };
}

export async function updateAssetAction(id: string, patch: UpdateAssetPatch): Promise<{ ok: boolean; asset?: Asset }> {
  const db = getDb();
  const asset = await db.updateAsset(id, patch);
  revalidatePath("/admin/assets");
  return { ok: true, asset };
}

/** Sets which templates may use `assetId` by rewriting each affected template's asset set. */
export async function setAssetAllowedTemplatesAction(assetId: string, templateIds: string[]): Promise<{ ok: boolean }> {
  const db = getDb();
  const templates = await db.listTemplates();
  const wanted = new Set(templateIds);

  await Promise.all(
    templates
      .filter((template) => template.allowedAssetIds.includes(assetId) !== wanted.has(template.id))
      .map((template) => {
        const nextIds = wanted.has(template.id)
          ? [...template.allowedAssetIds, assetId]
          : template.allowedAssetIds.filter((id) => id !== assetId);
        return db.setTemplateAssets(template.id, nextIds);
      }),
  );

  revalidatePath("/admin/assets");
  revalidatePath("/admin/templates");
  return { ok: true };
}
