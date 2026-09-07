/**
 * The default slide renderer — background, overlay, image slots and text-field layers
 * driven purely by `Template`/`TemplateField` configuration. Used for every template
 * whose `rendererKey` is "generic-v1" (or an unrecognized key — see `./index.ts`).
 *
 * Every field is drawn inside its own absolutely positioned box so a field can rotate
 * (angled "sticker" labels) and paint a solid box behind its text. Text lines come from
 * the layout engine already positioned in canvas coordinates; they are offset back into
 * the field box here. Inline `*bold*` / `_italic_` runs render as spans.
 */
import type { CSSProperties, ReactNode } from "react";
import type { TemplateField } from "@/lib/domain/types";
import type { RenderSlideInput, ResolvedAsset, SlideLayoutMap } from "../types";
import { effectiveFieldText } from "../fitText";

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

/** Serif families fall back to the self-hosted Tinos (Times metric twin), everything else to a sans. */
function fontStack(family: string): string {
  return /times|tinos|serif|georgia|garamond/i.test(family) ? `"${family}", "Tinos", serif` : `"${family}", sans-serif`;
}

/** The field box, rotated around its centre when the field asks for it. */
function fieldBoxStyle(field: TemplateField): CSSProperties {
  return {
    position: "absolute",
    left: field.x,
    top: field.y,
    width: field.width,
    height: field.height,
    transform: field.rotation ? `rotate(${field.rotation}deg)` : undefined,
    transformOrigin: "center center",
  };
}

function ImageField({ field, url }: { field: TemplateField; url: string | null }): ReactNode {
  const frame = field.frameColor && field.frameWidth > 0 ? `${field.frameWidth}px solid ${field.frameColor}` : undefined;
  return (
    <div
      key={field.fieldKey}
      data-image-field={field.fieldKey}
      style={{ ...fieldBoxStyle(field), boxSizing: "border-box", border: frame, overflow: "hidden" }}
    >
      {url ? (
        // Screenshotted 1:1 by headless Chromium — a plain <img> keeps pixel parity.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
      ) : null}
    </div>
  );
}

export function GenericRenderer(input: RenderSlideInput, layouts: SlideLayoutMap): ReactNode {
  const { template, slide } = input;
  const background = resolveBackground(input);
  const content = { headline: slide.headline, ...slide.content };

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
        if (field.fieldType === "image") {
          const key = effectiveFieldText(field, content);
          const url = key ? (input.imageUrls?.[key] ?? null) : null;
          return <ImageField key={field.fieldKey} field={field} url={url} />;
        }

        const fieldLayout = layouts[field.fieldKey];
        if (!fieldLayout) return null;
        const pad = field.boxColor ? field.boxPadding : 0;
        return (
          <div key={field.fieldKey} data-text-field={field.fieldKey} style={fieldBoxStyle(field)}>
            {field.boxColor ? (
              <div
                style={{
                  position: "absolute",
                  left: -pad,
                  top: -pad,
                  width: field.width + pad * 2,
                  height: field.height + pad * 2,
                  backgroundColor: field.boxColor,
                }}
              />
            ) : null}
            {fieldLayout.lines.map((line, index) => (
              <div
                key={`${field.fieldKey}-${index}`}
                style={{
                  position: "absolute",
                  left: line.x - field.x,
                  top: line.y - field.y,
                  fontFamily: fontStack(field.fontFamily),
                  fontSize: fieldLayout.fontSize,
                  fontWeight: field.fontWeight,
                  fontStyle: field.fontStyle,
                  letterSpacing: field.letterSpacing,
                  color: field.textColor,
                  lineHeight: 1,
                  whiteSpace: "pre",
                }}
              >
                {line.runs.length === 0
                  ? line.text
                  : line.runs.map((run, runIndex) =>
                      run.bold || run.italic ? (
                        <span
                          key={runIndex}
                          style={{
                            fontWeight: run.bold ? Math.max(700, field.fontWeight) : undefined,
                            fontStyle: run.italic ? "italic" : undefined,
                          }}
                        >
                          {run.text}
                        </span>
                      ) : (
                        run.text
                      ),
                    )}
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
