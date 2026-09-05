import type {
  Asset,
  FontRecord,
  SafeZone,
  Slide,
  Template,
  TemplateField,
} from "@/lib/domain/types";

export const SLIDE_WIDTH = 1920;
export const SLIDE_HEIGHT = 1080;

export interface ResolvedAsset {
  asset: Asset;
  /** Absolute URL or data: URI usable inside the renderer document. */
  url: string;
}

export interface ResolvedFont {
  font: FontRecord;
  /** Absolute URL or data: URI to the woff2 file. */
  url: string;
}

/**
 * Everything the renderer needs. The same input drives the browser preview
 * (React) and the server JPG render (headless Chromium) — one layout implementation.
 */
export interface RenderSlideInput {
  template: Template;
  slide: Slide;
  /** Effective background color hex when backgroundMode === "color". */
  backgroundColorHex: string | null;
  assets: ResolvedAsset[];
  fonts: ResolvedFont[];
  safeZone?: SafeZone;
  showSafeZone?: boolean;
  /** Optional locale for the safe-zone label only. Slide content is never translated. */
  safeZoneLabel?: string;
}

export interface RenderedSlide {
  /** JPEG bytes at 1920×1080. */
  jpeg: Uint8Array;
  width: number;
  height: number;
}

export type TextFitStatus = "fits" | "tight" | "overflow";

export interface TextFitResult {
  fieldKey: string;
  status: TextFitStatus;
  /** Font size actually used (px at 1920 scale). */
  fontSize: number;
  lines: number;
  /** Lines the text needed at the chosen size before clipping. */
  requiredLines: number;
  reason?: "max_lines" | "height" | "min_font_size" | "width";
}

export interface SlideFitResult {
  slideId: string;
  fields: TextFitResult[];
  /** True when every field fits — export is allowed. */
  exportable: boolean;
  /** Required fields with empty content. */
  missingRequired: string[];
}

/** Measures a single line of text — provided by the environment (canvas in browser, opentype/canvas on server). */
export interface TextMeasurer {
  measureWidth(text: string, font: FontSpec): number;
}

export interface FontSpec {
  family: string;
  size: number;
  weight: number;
  style: "normal" | "italic";
  letterSpacing: number;
}

export type FieldLayout = Pick<
  TemplateField,
  | "fieldKey"
  | "x"
  | "y"
  | "width"
  | "height"
  | "fontFamily"
  | "fontSize"
  | "minFontSize"
  | "fontWeight"
  | "fontStyle"
  | "lineHeight"
  | "letterSpacing"
  | "alignment"
  | "textColor"
  | "maxLines"
  | "overflowMode"
  | "textTransform"
  | "required"
>;
