/**
 * Domain-aware wrapper around the pure engine in `./engine.ts`. This is the entry point
 * consumers outside the renderer (Slide Editor, Template Studio) should import from —
 * `fitSlide` speaks in `Template`/`Slide` domain objects, unlike the JSON-only engine.
 *
 * Re-exports the pure primitives too, so `import { wrapLines, fitText, layoutLines } from
 * "@/lib/renderer/fitText"` works exactly as the tests expect.
 */
import type { Slide, Template, TemplateField } from "@/lib/domain/types";
import { computeSlideLayout, fitText, layoutLines, wrapLines } from "./engine";
import type { FieldLayout, SlideFitResult, SlideLayoutInput, TextFitResult, TextMeasurer } from "./types";

export { computeSlideLayout, fitText, layoutLines, wrapLines };

/** The field's content, keyed the same way `Slide.content` is, with `headline` folded in under its own key. */
export function buildContentMap(slide: Pick<Slide, "headline" | "content">): Record<string, string> {
  return { headline: slide.headline, ...slide.content };
}

function toFieldLayout(field: TemplateField): FieldLayout {
  // `TemplateField` structurally contains every `FieldLayout` property.
  return field;
}

/** Plain, JSON-serializable layout input for `computeSlideLayout` — usable in a headless page. */
export function buildSlideLayoutInput(
  template: Pick<Template, "fields">,
  slide: Pick<Slide, "headline" | "content">,
): SlideLayoutInput {
  return {
    fields: template.fields.map(toFieldLayout),
    content: buildContentMap(slide),
  };
}

/** Combines per-field fit results into the slide-level verdict (`missingRequired`, `exportable`). */
export function buildSlideFitResult(
  slideId: string,
  fields: FieldLayout[],
  content: Record<string, string>,
  fitResults: TextFitResult[],
): SlideFitResult {
  const missingRequired = fields
    .filter((field) => field.required && (content[field.fieldKey] ?? "").trim() === "")
    .map((field) => field.fieldKey);
  const exportable = missingRequired.length === 0 && fitResults.every((result) => result.status !== "overflow");
  return { slideId, fields: fitResults, exportable, missingRequired };
}

/**
 * Fits every field of `template` against `slide`'s content, using `measurer` (typically
 * `createCanvasMeasurer(document)` in the browser). Used by the Sunday Slide Editor's
 * live "text fit" state — the browser has a canvas, so no headless render is needed.
 */
export function fitSlide(
  template: Pick<Template, "fields">,
  slide: Pick<Slide, "id" | "headline" | "content">,
  measurer: TextMeasurer,
): SlideFitResult {
  const content = buildContentMap(slide);
  const fields = template.fields.map(toFieldLayout);
  const fitResults = fields.map((field) => fitText(content[field.fieldKey] ?? "", field, measurer));
  return buildSlideFitResult(slide.id, fields, content, fitResults);
}
