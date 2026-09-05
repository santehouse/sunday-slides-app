"use client";

/**
 * Live slide render used for template/asset thumbnails, the Template Studio
 * canvas and the Slide Editor preview — always the ONE renderer
 * (`src/lib/renderer/`), never a second hand-drawn preview (CLAUDE.md rule 6).
 */
import { useEffect, useMemo, useState } from "react";
import { SlideCanvas, SlideFrame } from "@/lib/renderer/SlideCanvas";
import { computeSlideLayout } from "@/lib/renderer/engine";
import { createCanvasMeasurer, ensureFontsLoaded } from "@/lib/renderer/measure";
import type { RenderSlideInput, SlideLayoutMap } from "@/lib/renderer/types";
import type {
  BackgroundType,
  OverlayColor,
  SafeZone,
  Slide,
  Template,
  TemplateField,
} from "@/lib/domain/types";

export type TemplatePreviewProps = {
  rendererKey?: string;
  fields: TemplateField[];
  content: Record<string, string>;
  backgroundType: BackgroundType;
  backgroundColorHex?: string | null;
  backgroundImageUrl?: string | null;
  backgroundFocal?: { x: number; y: number };
  overlayColor?: OverlayColor;
  overlayOpacity?: number;
  safeZone?: SafeZone;
  showSafeZone?: boolean;
  safeZoneLabel?: string;
  className?: string;
};

/** Renders a template/slide via the real renderer, scaled to fill its container (16:9). */
export function TemplatePreview({
  rendererKey = "generic-v1",
  fields,
  content,
  backgroundType,
  backgroundColorHex,
  backgroundImageUrl,
  backgroundFocal,
  overlayColor = "none",
  overlayOpacity = 0,
  safeZone,
  showSafeZone = false,
  safeZoneLabel,
  className,
}: TemplatePreviewProps) {
  const [layouts, setLayouts] = useState<SlideLayoutMap | null>(null);

  const input: RenderSlideInput = useMemo(() => {
    const hasImage = backgroundType === "image" && Boolean(backgroundImageUrl);
    const template: Template = {
      id: "preview",
      slug: "preview",
      nameEn: "",
      nameFr: "",
      category: "general",
      status: "draft",
      rendererKey,
      backgroundType,
      backgroundValue: hasImage ? "preview-asset" : (backgroundColorHex ?? "#0f172a"),
      overlayColor,
      overlayOpacity,
      includeInVideoDefault: true,
      allowTeamBackgroundChoice: false,
      fields,
      allowedAssetIds: [],
      createdAt: "",
      updatedAt: "",
    };
    const slide: Slide = {
      id: "preview-slide",
      sundayId: "",
      templateId: "preview",
      headline: content.headline ?? "",
      content,
      assetId: hasImage ? "preview-asset" : null,
      backgroundMode: backgroundType,
      approvedColorId: null,
      sortOrder: 0,
      includeInVideo: true,
      status: "ready",
      isStructural: false,
      structuralDefaultId: null,
      parserConfidence: null,
      mappingId: null,
      sourceAnnouncement: null,
      manuallyEdited: false,
      createdAt: "",
      updatedAt: "",
    };
    return {
      template,
      slide,
      backgroundColorHex: backgroundType === "color" ? (backgroundColorHex ?? "#0f172a") : null,
      assets: hasImage
        ? [
            {
              asset: {
                id: "preview-asset",
                nameEn: "",
                nameFr: "",
                status: "published",
                category: "backgrounds",
                tags: [],
                r2Key: "",
                mimeType: "image/jpeg",
                width: 1920,
                height: 1080,
                focalX: backgroundFocal?.x ?? 0.5,
                focalY: backgroundFocal?.y ?? 0.5,
                cropMetadata: null,
                createdAt: "",
                updatedAt: "",
              },
              url: backgroundImageUrl as string,
            },
          ]
        : [],
      fonts: [],
      safeZone,
      showSafeZone,
      safeZoneLabel,
    };
  }, [
    rendererKey,
    fields,
    content,
    backgroundType,
    backgroundColorHex,
    backgroundImageUrl,
    backgroundFocal,
    overlayColor,
    overlayOpacity,
    safeZone,
    showSafeZone,
    safeZoneLabel,
  ]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const fontSpecs = fields.map((f) => ({ family: f.fontFamily, weight: f.fontWeight, style: f.fontStyle }));
      await ensureFontsLoaded(fontSpecs, document);
      const measurer = createCanvasMeasurer(document);
      const layout = computeSlideLayout({ fields, content }, measurer);
      if (!cancelled) setLayouts(layout);
    }
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(fields), JSON.stringify(content)]);

  return (
    <div className={className} style={{ width: "100%", height: "100%", position: "relative" }}>
      {layouts ? (
        <SlideFrame>
          <SlideCanvas input={input} layouts={layouts} />
        </SlideFrame>
      ) : (
        <div style={{ width: "100%", height: "100%", background: "var(--bg-surface-subtle)" }} />
      )}
    </div>
  );
}
