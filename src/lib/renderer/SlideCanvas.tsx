/**
 * The one slide layout implementation. `SlideCanvas` itself uses no hooks and reads no
 * browser globals — it is a pure function of `input` + a precomputed `layouts` map, so
 * it renders identically via `renderToStaticMarkup` on the server (inside the headless
 * page, for the JPG/MP4 pipeline) and as a plain React element in the browser preview.
 * `layouts` is *always* supplied by the caller (see `computeSlideLayout` in
 * `./engine.ts`) — this component never measures text itself.
 *
 * This file is deliberately server-safe (no "use client", no hooks) so the JPG/MP4
 * renderer in `./server.ts` can call `renderToStaticMarkup(<SlideCanvas />)` inside a
 * Next route handler. The browser-only scaling wrapper lives in `./SlideFrame.tsx`.
 */
import type { SafeZone } from "@/lib/domain/types";
import { SLIDE_HEIGHT, SLIDE_WIDTH } from "./types";
import type { RenderSlideInput, ResolvedFont, SlideLayoutMap } from "./types";
import { getRenderer } from "./renderers";

export interface SlideCanvasProps {
  input: RenderSlideInput;
  layouts: SlideLayoutMap;
}

// QA: the guide must read as a danger zone (nothing may sit under the live camera),
// so it is drawn as a red dashed frame over grey diagonal hatching — the UI label is
// unchanged. Preview-only: exports never render it (see SlideCanvas below).
const SAFE_ZONE_COLOR = "#dc2626";
const SAFE_ZONE_HATCH =
  "repeating-linear-gradient(135deg, rgba(107, 114, 128, 0.45) 0 10px, rgba(107, 114, 128, 0.08) 10px 24px)";

function SafeZoneGuide({ zone, label }: { zone: SafeZone; label: string }) {
  return (
    <div
      data-safe-zone=""
      style={{
        position: "absolute",
        left: zone.x,
        top: zone.y,
        width: zone.width,
        height: zone.height,
        boxSizing: "border-box",
        border: `4px dashed ${SAFE_ZONE_COLOR}`,
        backgroundImage: SAFE_ZONE_HATCH,
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          display: "inline-block",
          margin: 8,
          padding: "2px 10px",
          fontFamily: '"Arimo", sans-serif',
          fontSize: 18,
          fontWeight: 700,
          color: "#ffffff",
          backgroundColor: SAFE_ZONE_COLOR,
          borderRadius: 4,
        }}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * Renders the slide body via the template's registered renderer, plus the editor-only
 * safe-zone guide. NEVER renders the guide unless `showSafeZone` is explicitly true —
 * exports must always pass `showSafeZone: false` (or omit it).
 */
export function SlideCanvas({ input, layouts }: SlideCanvasProps) {
  const renderer = getRenderer(input.template.rendererKey);

  return (
    <div
      data-slide-canvas=""
      style={{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT, position: "relative", overflow: "hidden" }}
    >
      {renderer(input, layouts)}
      {input.showSafeZone && input.safeZone ? (
        <SafeZoneGuide zone={input.safeZone} label={input.safeZoneLabel ?? "LIVE CAMERA / SAFE ZONE"} />
      ) : null}
    </div>
  );
}


function fontFormat(url: string): string {
  // Inlined fonts arrive as data URIs; read the format from the MIME type instead of an extension.
  const dataMime = /^data:font\/(woff2|woff|ttf|otf)/i.exec(url)?.[1]?.toLowerCase();
  const ext = dataMime ?? url.split("?")[0]?.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "woff":
      return "woff";
    case "ttf":
      return "truetype";
    case "otf":
      return "opentype";
    default:
      return "woff2";
  }
}

/**
 * `@font-face` rules for `fonts` — used by the server renderer to inline every custom
 * font a template needs directly into the document it screenshots (no network round
 * trip inside the headless page). The browser preview does not need this for Arimo/
 * Tinos (loaded globally via `globals.css`) but does for admin-enabled custom fonts.
 */
export function buildFontFaceCss(fonts: ResolvedFont[]): string {
  return fonts
    .map(
      ({ font, url }) => `@font-face {
  font-family: "${font.family}";
  font-style: ${font.style};
  font-weight: ${font.weight};
  font-display: block;
  src: url("${url}") format("${fontFormat(url)}");
}`,
    )
    .join("\n");
}
