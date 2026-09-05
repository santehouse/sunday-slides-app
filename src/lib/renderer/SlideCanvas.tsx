"use client";

/**
 * The one slide layout implementation. `SlideCanvas` itself uses no hooks and reads no
 * browser globals — it is a pure function of `input` + a precomputed `layouts` map, so
 * it renders identically via `renderToStaticMarkup` on the server (inside the headless
 * page, for the JPG/MP4 pipeline) and as a plain React element in the browser preview.
 * `layouts` is *always* supplied by the caller (see `computeSlideLayout` in
 * `./engine.ts`) — this component never measures text itself.
 *
 * `"use client"` above only exists because `SlideFrame` (in this same file) uses
 * `useState`/`useEffect` for its ResizeObserver-driven scaling. It does not stop
 * `SlideCanvas` from being rendered with `react-dom/server` outside of Next's App
 * Router component graph, which is exactly what `src/lib/renderer/server.ts` does.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { SafeZone } from "@/lib/domain/types";
import { SLIDE_HEIGHT, SLIDE_WIDTH } from "./types";
import type { RenderSlideInput, ResolvedFont, SlideLayoutMap } from "./types";
import { getRenderer } from "./renderers";

export interface SlideCanvasProps {
  input: RenderSlideInput;
  layouts: SlideLayoutMap;
}

const SAFE_ZONE_COLOR = "#4f46e5";

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
        backgroundColor: "rgba(79, 70, 229, 0.12)",
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
          color: SAFE_ZONE_COLOR,
          backgroundColor: "#ffffff",
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

/**
 * Client-only scaling wrapper: measures its own box with a `ResizeObserver` and scales a
 * fixed 1920×1080 child down (or up) via CSS `transform`, preserving 16:9 regardless of
 * the container's aspect ratio. Use around `<SlideCanvas />` anywhere it's shown at less
 * than full resolution (Sunday Flow cards, Slide Editor preview, template thumbnails).
 */
export function SlideFrame({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      setScale(Math.min(width / SLIDE_WIDTH, height / SLIDE_HEIGHT));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
      <div
        style={{
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          position: "absolute",
          top: 0,
          left: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          visibility: scale > 0 ? "visible" : "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function fontFormat(url: string): string {
  const ext = url.split("?")[0]?.split(".").pop()?.toLowerCase();
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
