"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/data";
import { getSignedUploadUrl, putObject, keys } from "@/lib/r2/client";
import { hasR2 } from "@/lib/env";
import type { UploadTicket } from "@/lib/uploads/direct";
import { readImageDimensions } from "@/components/admin/imageDimensions";
import type { Asset, AssetCategory } from "@/lib/domain/types";
import type { UpdateAssetPatch } from "@/lib/data";

/** Fallback path only (no object store): Server Actions are capped at 4 MB (next.config.ts). */
const MAX_ASSET_BYTES = 4 * 1024 * 1024;
/** Direct-to-storage path: the browser PUTs to a signed URL, so a full-size photo is fine. */
const MAX_DIRECT_ASSET_BYTES = 25 * 1024 * 1024;
const ASSET_KEY_PATTERN = /^assets\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

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

/**
 * Step 1 of a direct upload: validates the file's type/size and returns a signed PUT URL
 * for the object store (or tells the browser to use the classic action when there is none).
 */
export async function createAssetUploadTicketAction(input: {
  filename: string;
  contentType: string;
  size: number;
}): Promise<UploadTicket> {
  const ext = MIME_EXT[input.contentType];
  if (!ext) return { mode: "error", error: "unsupported_file" };
  if (!hasR2()) {
    return input.size > MAX_ASSET_BYTES ? { mode: "error", error: "file_too_large" } : { mode: "action" };
  }
  if (input.size > MAX_DIRECT_ASSET_BYTES) return { mode: "error", error: "file_too_large" };
  const key = keys.assets(randomUUID(), ext);
  const url = await getSignedUploadUrl(key, input.contentType, 600);
  return { mode: "direct", url, key };
}

/** Step 2 of a direct upload: the bytes are already in the store; record the asset. */
export async function finalizeAssetUploadAction(input: {
  key: string;
  contentType: string;
  nameEn: string;
  category: AssetCategory;
  width: number;
  height: number;
}): Promise<UploadAssetState> {
  if (!ASSET_KEY_PATTERN.test(input.key) || !MIME_EXT[input.contentType]) {
    return { status: "error", message: "unsupported_file" };
  }
  const width = Math.max(1, Math.round(input.width));
  const height = Math.max(1, Math.round(input.height));
  const db = getDb();
  const asset = await db.createAsset({
    nameEn: input.nameEn.trim() || input.key,
    nameFr: input.nameEn.trim() || input.key,
    status: "draft",
    category: input.category,
    tags: [],
    r2Key: input.key,
    mimeType: input.contentType,
    width,
    height,
  });
  revalidatePath("/admin/assets");
  return { status: "success", asset };
}
