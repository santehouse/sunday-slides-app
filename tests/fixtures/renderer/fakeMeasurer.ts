import type { FieldLayout, FontSpec, TextMeasurer } from "@/lib/renderer/types";
import type { Slide, Template, TemplateField } from "@/lib/domain/types";

/**
 * Deterministic stand-in for a canvas measurer: width = chars × size × 0.55, plus
 * letter-spacing between characters. No font metrics involved, so tests can hand-derive
 * the exact expected widths for a given string/size.
 */
export function createFakeMeasurer(): TextMeasurer {
  return {
    measureWidth(text: string, font: FontSpec): number {
      const base = text.length * font.size * 0.55;
      const extra = text.length > 1 ? font.letterSpacing * (text.length - 1) : 0;
      return base + extra;
    },
  };
}

export function makeFieldLayout(overrides: Partial<FieldLayout> = {}): FieldLayout {
  return {
    fieldKey: "headline",
    x: 100,
    y: 100,
    width: 800,
    height: 200,
    fontFamily: "Arimo",
    fontSize: 60,
    minFontSize: 30,
    fontWeight: 700,
    fontStyle: "normal",
    lineHeight: 1.1,
    letterSpacing: 0,
    alignment: "left",
    textColor: "#ffffff",
    maxLines: 2,
    overflowMode: "fixed",
    textTransform: "none",
    required: true,
    ...overrides,
  };
}

export function makeTemplateField(overrides: Partial<TemplateField> = {}): TemplateField {
  return {
    id: "field-1",
    templateId: "template-1",
    fieldType: "text",
    labelEn: "Headline",
    labelFr: "Titre",
    teamEditable: true,
    sortOrder: 0,
    fontId: null,
    ...makeFieldLayout(overrides),
    ...overrides,
  };
}

export function makeTemplate(fields: TemplateField[]): Pick<Template, "fields"> {
  return { fields };
}

export function makeSlide(overrides: Partial<Slide> = {}): Pick<Slide, "id" | "headline" | "content"> {
  return {
    id: "slide-1",
    headline: "",
    content: {},
    ...overrides,
  };
}
