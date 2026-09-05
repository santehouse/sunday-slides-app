import "server-only";

/**
 * Font resolution (section 36 of BUILD_HANDOFF.md): turns catalog `FontRecord`s into
 * usable URLs for the renderer.
 *
 *  - Arimo/Tinos ("google" source, our two default UI/slide fonts): always resolved to
 *    our own self-hosted files under `public/fonts/` — parsed from `arimo.css`/
 *    `tinos.css` — never fetched from Google at render time.
 *  - Other "google" families: fetched from the Google Fonts CSS2 API once, then cached
 *    in the object store (`fonts/google/…`) so later renders never re-hit Google.
 *  - "custom" families: a signed read URL for the admin-uploaded R2 object.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { FontRecord } from "@/lib/domain/types";
import { getObjectStore, getSignedReadUrl } from "@/lib/r2/client";
import type { ResolvedFont } from "@/lib/renderer/types";

const GOOGLE_FONTS_CSS2_URL = "https://fonts.googleapis.com/css2";
// A modern desktop Chrome UA — Google Fonts serves woff2 (vs. legacy ttf/eot) based on it.
const CHROME_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const SELF_HOSTED_FAMILIES = new Set(["Arimo", "Tinos"]);

interface ParsedFontFace {
  subset: string;
  style: string;
  weight: number;
  /** Path relative to `public/`, e.g. "/fonts/arimo/xxxx.woff2". */
  srcPath: string;
}

function parseFontCss(cssText: string): ParsedFontFace[] {
  const entries: ParsedFontFace[] = [];
  const blockRegex = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*{([^}]*)}/g;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(cssText))) {
    const [, subset, body] = match;
    const style = /font-style:\s*([a-z]+)/.exec(body)?.[1] ?? "normal";
    const weight = Number(/font-weight:\s*(\d+)/.exec(body)?.[1] ?? "400");
    const srcPath = /url\(([^)]+)\)/.exec(body)?.[1]?.trim() ?? "";
    entries.push({ subset, style, weight, srcPath });
  }
  return entries;
}

const selfHostedCssCache = new Map<string, ParsedFontFace[]>();
async function loadSelfHostedCss(family: string): Promise<ParsedFontFace[]> {
  const cached = selfHostedCssCache.get(family);
  if (cached) return cached;
  const cssPath = path.join(process.cwd(), "public", "fonts", `${family.toLowerCase()}.css`);
  const cssText = await fs.readFile(cssPath, "utf8");
  const entries = parseFontCss(cssText);
  selfHostedCssCache.set(family, entries);
  return entries;
}

/** Arimo/Tinos ship as static 400/700 files; anything requested in between snaps to the nearer one. */
function nearestSelfHostedWeight(weight: number): number {
  return weight >= 600 ? 700 : 400;
}

async function resolveSelfHostedFont(record: FontRecord): Promise<ResolvedFont> {
  const entries = await loadSelfHostedCss(record.family);
  const weight = nearestSelfHostedWeight(record.weight);
  const match = entries.find((e) => e.subset === "latin" && e.style === record.style && e.weight === weight);
  if (!match) {
    throw new Error(`resolveFonts: no self-hosted file found for ${record.family} ${weight} ${record.style}`);
  }
  return { font: record, url: match.srcPath };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Google Fonts CSS2 URL for `family` at the given `weights` — also used by the admin
 * "enable Google Font" flow to preview/validate a family before it's added to the
 * catalog, independent of rendering.
 */
export function googleFontCssForFamily(family: string, weights: number[]): string {
  const spec = Array.from(new Set(weights))
    .sort((a, b) => a - b)
    .join(";");
  const params = new URLSearchParams({ family: `${family}:wght@${spec}`, display: "swap" });
  return `${GOOGLE_FONTS_CSS2_URL}?${params.toString()}`;
}

function extractFirstWoff2Url(cssText: string): string | null {
  const match = /src:\s*url\(([^)]+)\)\s*format\(['"]woff2['"]\)/.exec(cssText);
  return match ? match[1].replace(/^['"]|['"]$/g, "") : null;
}

function googleCacheKey(record: FontRecord): string {
  const family = record.sourceIdentifier ?? record.family;
  return `fonts/google/${slugify(family)}-${record.weight}-${record.style}.woff2`;
}

async function resolveGoogleFont(record: FontRecord): Promise<ResolvedFont> {
  const store = getObjectStore();
  const cacheKey = googleCacheKey(record);

  const alreadyCached = await store
    .getObject(cacheKey)
    .then(() => true)
    .catch(() => false);

  if (!alreadyCached) {
    const family = record.sourceIdentifier ?? record.family;
    const cssRes = await fetch(googleFontCssForFamily(family, [record.weight]), {
      headers: { "User-Agent": CHROME_USER_AGENT },
    });
    if (!cssRes.ok) {
      throw new Error(`resolveFonts: failed to fetch Google Fonts CSS for "${family}": HTTP ${cssRes.status}`);
    }
    const woff2Url = extractFirstWoff2Url(await cssRes.text());
    if (!woff2Url) {
      throw new Error(`resolveFonts: no woff2 URL found in the Google Fonts CSS for "${family}"`);
    }

    const fontRes = await fetch(woff2Url);
    if (!fontRes.ok) {
      throw new Error(`resolveFonts: failed to download font file for "${family}": HTTP ${fontRes.status}`);
    }
    const bytes = new Uint8Array(await fontRes.arrayBuffer());
    await store.putObject(cacheKey, bytes, "font/woff2");
  }

  return { font: record, url: await store.getSignedReadUrl(cacheKey) };
}

async function resolveCustomFont(record: FontRecord): Promise<ResolvedFont> {
  if (!record.r2Key) {
    throw new Error(`resolveFonts: custom font "${record.family}" has no r2Key`);
  }
  return { font: record, url: await getSignedReadUrl(record.r2Key) };
}

/**
 * Resolves every enabled `FontRecord` in `fontRecords` whose `family` is one of
 * `families` into a `ResolvedFont` with a usable URL. `families` is typically the set of
 * distinct `TemplateField.fontFamily` values a slide actually needs — records for
 * families not requested are skipped.
 */
export async function resolveFonts(fontRecords: FontRecord[], families: string[]): Promise<ResolvedFont[]> {
  const wanted = new Set(families);
  const needed = fontRecords.filter((record) => record.enabled && wanted.has(record.family));

  return Promise.all(
    needed.map((record) => {
      if (SELF_HOSTED_FAMILIES.has(record.family)) return resolveSelfHostedFont(record);
      if (record.source === "custom") return resolveCustomFont(record);
      return resolveGoogleFont(record);
    }),
  );
}
