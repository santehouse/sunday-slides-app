/**
 * The default slide renderer — background, overlay, and text-field layers driven purely
 * by `Template`/`TemplateField` configuration. Used for every template whose
 * `rendererKey` is "generic-v1" (or an unrecognized key — see `./index.ts`).
 */
import type { ReactNode } from "react";
import type { RenderSlideInput, ResolvedAsset, SlideLayoutMap } from "../types";

function resolveBackground(input: RenderSlideInput): { color?: string; asset?: ResolvedAsset } {
  const { template, slide, backgroundColorHex, assets } = input;
  const mode = slide.backgroundMode ?? template.backgroundType;

  if (mode === "image") {
    const bySlideAsset = slide.assetId ? assets.find((a) => a.asset.id === slide.assetId) : undefined;
    const byTemplateAsset =
      template.backgroundType === "image" ? assets.find((a) => a.asset.id === template.backgroundValue) : undefined;
    const resolved = bySlideAsset ?? byTemplateAsset;
    if (resolved) return { asset: resolved };
  }

  const color = backgroundColorHex ?? (template.backgroundType === "color" ? template.backgroundValue : "#000000");
  return { color };
}

export function GenericRenderer(input: RenderSlideInput, layouts: SlideLayoutMap): ReactNode {
  const { template } = input;
  const background = resolveBackground(input);

  return (
    <>
      {background.asset ? (
        // This markup is screenshotted 1:1 by headless Chromium (and must match the
        // plain-HTML shell server.ts builds) — next/image's optimizer route and
        // lazy-loading would break that pixel parity.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={background.asset.url}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: `${background.asset.asset.focalX * 100}% ${background.asset.asset.focalY * 100}%`,
          }}
        />
      ) : (
        <div style={{ position: "absolute", inset: 0, backgroundColor: background.color }} />
      )}

      {template.overlayColor !== "none" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: template.overlayColor === "black" ? "#000000" : "#ffffff",
            opacity: template.overlayOpacity,
          }}
        />
      )}

      {template.fields.map((field) => {
        const fieldLayout = layouts[field.fieldKey];
        if (!fieldLayout) return null;
        return fieldLayout.lines.map((line, index) => (
          <div
            key={`${field.fieldKey}-${index}`}
            style={{
              position: "absolute",
              left: line.x,
              top: line.y,
              fontFamily: `"${field.fontFamily}", sans-serif`,
              fontSize: fieldLayout.fontSize,
              fontWeight: field.fontWeight,
              fontStyle: field.fontStyle,
              letterSpacing: field.letterSpacing,
              color: field.textColor,
              lineHeight: 1,
              whiteSpace: "pre",
            }}
          >
            {line.text}
          </div>
        ));
      })}
    </>
  );
}
