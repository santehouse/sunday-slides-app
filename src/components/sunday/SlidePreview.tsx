"use client";

/**
 * The one Sunday-side preview/thumbnail component. Wraps `SlideFrame` + `SlideCanvas`
 * (the actual renderer — see `src/lib/renderer/`) with the client-side layout pass
 * (`ensureFontsLoaded` + `createCanvasMeasurer` + `computeSlideLayout`) so every
 * thumbnail and preview on the Sunday screens is a real render of the template, never a
 * hand-drawn placeholder (BUILD_HANDOFF.md section 14).
 */
import { useEffect, useState } from "react";
import type { Slide, Template } from "@/lib/domain/types";
import { SlideCanvas } from "@/lib/renderer/SlideCanvas";
import { SlideFrame } from "@/lib/renderer/SlideFrame";
import { buildSlideLayoutInput, computeSlideLayout } from "@/lib/renderer/fitText";
import { createCanvasMeasurer, ensureFontsLoaded } from "@/lib/renderer/measure";
import type { ResolvedAsset, SlideLayoutMap } from "@/lib/renderer/types";
import { browserImageUrls } from "@/lib/renderer/imageUrls";

export type SlidePreviewSlide = Pick<Slide, "id" | "headline" | "content" | "backgroundMode" | "assetId">;

export type SlidePreviewProps = {
  template: Template;
  slide: SlidePreviewSlide;
  backgroundColorHex?: string | null;
  assets?: ResolvedAsset[];
  safeZone?: { x: number; y: number; width: number; height: number };
  showSafeZone?: boolean;
  safeZoneLabel?: string;
  className?: string;
};

/** Renders `template` + `slide.content` live, at any size — parent controls the box. */
export function SlidePreview({
  template,
  slide,
  backgroundColorHex = null,
  assets = [],
  safeZone,
  showSafeZone,
  safeZoneLabel,
  className,
}: SlidePreviewProps) {
  const [layouts, setLayouts] = useState<SlideLayoutMap | null>(null);
  const contentKey = JSON.stringify(slide.content);
  const imageUrls = browserImageUrls(template, slide);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const fonts = template.fields.map((field) => ({
        family: field.fontFamily,
        weight: field.fontWeight,
        style: field.fontStyle,
      }));
      await ensureFontsLoaded(fonts, document);
      if (cancelled) return;
      const measurer = createCanvasMeasurer(document);
      const input = buildSlideLayoutInput(template, slide);
      setLayouts(computeSlideLayout(input, measurer));
    }
    run();
    return () => {
      cancelled = true;
    };
    // `contentKey` covers slide.content changes; template.id covers template swaps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id, slide.headline, contentKey]);

  return (
    <div className={className} style={{ width: "100%", height: "100%" }} aria-hidden="true">
      <SlideFrame>
        {layouts ? (
          <SlideCanvas
            input={{
              template,
              slide: slide as Slide,
              backgroundColorHex,
              assets,
              fonts: [],
              imageUrls,
              safeZone,
              showSafeZone,
              safeZoneLabel,
            }}
            layouts={layouts}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", backgroundColor: "var(--bg-surface-subtle)" }} />
        )}
      </SlideFrame>
    </div>
  );
}
