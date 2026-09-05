/**
 * Canvas-based `TextMeasurer`. Runs unmodified in the real browser (Slide Editor preview)
 * and inside the headless Chromium page used by the server renderer — same code, same
 * metrics, which is the whole basis for pixel parity between preview/JPG/MP4.
 *
 * Like `./engine.ts`, this module has ZERO value imports so `server.ts` can inline its
 * compiled source into the headless page with `Function.prototype.toString`. Keep every
 * function here a top-level `export function` (not an arrow `const`) for the same reason.
 */
import type { FontSpec, TextMeasurer } from "./types";

/** A font family + weight/style combination worth pre-loading before measuring. */
export interface FontLoadSpec {
  family: string;
  weight: number;
  style: "normal" | "italic";
}

export function cssFont(font: FontSpec): string {
  return `${font.style} ${font.weight} ${font.size}px "${font.family}"`;
}

export function measurementCacheKey(text: string, font: FontSpec): string {
  return `${font.family}|${font.weight}|${font.style}|${font.size}|${font.letterSpacing}|${text}`;
}

/**
 * Offscreen-canvas measurer. `letterSpacing` is added on top of `measureText` because
 * canvas 2D context letter-spacing support is inconsistent across the Chromium versions
 * this app targets in the browser vs. headless — computing it ourselves keeps parity.
 */
export function createCanvasMeasurer(doc: Document): TextMeasurer {
  const canvas = doc.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("createCanvasMeasurer: 2D canvas context is unavailable");
  }
  const cache = new Map<string, number>();

  return {
    measureWidth(text: string, font: FontSpec): number {
      const key = measurementCacheKey(text, font);
      const cached = cache.get(key);
      if (cached !== undefined) return cached;

      ctx.font = cssFont(font);
      const base = ctx.measureText(text).width;
      const extra = text.length > 1 ? font.letterSpacing * (text.length - 1) : 0;
      const width = base + extra;

      cache.set(key, width);
      return width;
    },
  };
}

/**
 * Forces the browser to fetch and decode every family/weight/style combination in
 * `fonts` before any measurement happens. `document.fonts.ready` alone only waits for
 * loads that have already been *triggered* by something painting with that font — a
 * blank canvas or an empty text container never triggers one, so this is required
 * both in the live preview and inside the headless page.
 */
export async function ensureFontsLoaded(fonts: FontLoadSpec[], doc: Document): Promise<void> {
  const seen = new Set<string>();
  const loads: Promise<unknown>[] = [];

  for (const font of fonts) {
    const key = `${font.family}|${font.weight}|${font.style}`;
    if (seen.has(key)) continue;
    seen.add(key);
    loads.push(doc.fonts.load(`${font.style} ${font.weight} 32px "${font.family}"`));
  }

  await Promise.all(loads);
  await doc.fonts.ready;
}
