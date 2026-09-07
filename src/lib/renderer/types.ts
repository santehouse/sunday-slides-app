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
  /** URLs for image-field pictures, keyed by the storage key held in `slide.content[fieldKey]`. */
  imageUrls?: Record<string, string>;
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
  /** Fit result for every field on the slide, computed with the same in-page measurer used to render it. */
  fit: SlideFitResult;
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
> & {
  /** "image" fields hold no text and are never fitted; defaults to "text". */
  fieldType?: "text" | "image";
};

/** A word with the inline style it was marked up with (`*bold*`, `_italic_`). */
export interface StyledWord {
  text: string;
  bold: boolean;
  italic: boolean;
}

/** A same-styled slice of a laid-out line; runs concatenate (spaces included) into the rendered line. */
export interface LayoutRun {
  text: string;
  /** Offset from the line's own x. */
  x: number;
  width: number;
  bold: boolean;
  italic: boolean;
}

/** One positioned, pre-measured line of text — ready to render as an absolutely positioned block. */
export interface LayoutLine {
  /** Plain text (inline markup stripped). */
  text: string;
  /** Styled slices making up the line, in order. */
  runs: LayoutRun[];
  /** Absolute x in the 1920×1080 canvas. */
  x: number;
  /** Absolute y in the 1920×1080 canvas. */
  y: number;
  /** Measured width of this line at the chosen font size. */
  width: number;
}

/** Result of laying out a single field: the font size actually used and its positioned lines. */
export interface FieldLayoutResult {
  fontSize: number;
  lines: LayoutLine[];
}

/** `layoutLines()` plus the fit verdict for the same field, at the same computed font size. */
export interface SlideLayoutField extends FieldLayoutResult {
  fit: TextFitResult;
}

/** Plain, JSON-serializable input to `computeSlideLayout` — safe to pass into a headless page via page.evaluate. */
export interface SlideLayoutInput {
  fields: FieldLayout[];
  /** Field content keyed by fieldKey (the slide's `headline` is included under key "headline"). */
  content: Record<string, string>;
}

/** `computeSlideLayout` output: one `SlideLayoutField` per field, keyed by fieldKey. */
export type SlideLayoutMap = Record<string, SlideLayoutField>;
