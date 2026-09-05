import "server-only";

/**
 * Resolves an `Asset` to a viewable URL for Admin screens (thumbnails, focal
 * point picker, template background pickers). Mock mode has no real object
 * store, so it renders the same deterministic placeholder SVG the mock
 * seed uses; otherwise it's a signed R2 read URL.
 */
import { isMockMode } from "@/lib/env";
import { getSignedReadUrl } from "@/lib/r2/client";
import { mockAssetUrl } from "@/lib/data/mockSeed";
import type { Asset } from "@/lib/domain/types";

const PLACEHOLDER_COLORS = ["#1e293b", "#312e81", "#7c3aed", "#4f46e5", "#0f172a", "#0e7490"];

function placeholderColorFor(assetId: string): string {
  let hash = 0;
  for (let i = 0; i < assetId.length; i += 1) hash = (hash * 31 + assetId.charCodeAt(i)) >>> 0;
  return PLACEHOLDER_COLORS[hash % PLACEHOLDER_COLORS.length]!;
}

export async function resolveAssetUrl(asset: Asset): Promise<string> {
  if (isMockMode()) {
    return mockAssetUrl({ nameEn: asset.nameEn, color: placeholderColorFor(asset.id) });
  }
  return getSignedReadUrl(asset.r2Key);
}

export async function resolveAssetUrls(assets: Asset[]): Promise<Record<string, string>> {
  const entries = await Promise.all(assets.map(async (asset) => [asset.id, await resolveAssetUrl(asset)] as const));
  return Object.fromEntries(entries);
}
