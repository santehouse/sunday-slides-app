import { describe, expect, it } from "vitest";
import { buildContentMap, computeSlideLayout, fitSlide, fitText, layoutLines, wrapLines } from "@/lib/renderer/fitText";
import type { FontSpec } from "@/lib/renderer/types";
import {
  createFakeMeasurer,
  makeFieldLayout,
  makeSlide,
  makeTemplate,
  makeTemplateField,
} from "../../fixtures/renderer/fakeMeasurer";

const measurer = createFakeMeasurer();

function font(overrides: Partial<FontSpec> = {}): FontSpec {
  return { family: "Arimo", size: 40, weight: 400, style: "normal", letterSpacing: 0, ...overrides };
}

describe("wrapLines", () => {
  it("keeps short text on one line", () => {
    const lines = wrapLines("Hello World", font({ size: 40 }), 800, measurer);
    expect(lines).toEqual(["Hello World"]);
  });

  it("greedily wraps at the width limit", () => {
    // "HELLO WORLD" alone = 11*40*0.55 = 242; "HELLO WORLD FOO" = 15*40*0.55 = 330 > 300.
    const lines = wrapLines("HELLO WORLD FOO", font({ size: 40 }), 300, measurer);
    expect(lines).toEqual(["HELLO WORLD", "FOO"]);
  });

  it("honours explicit newlines regardless of width", () => {
    const lines = wrapLines("Line one\nLine two", font({ size: 20 }), 2000, measurer);
    expect(lines).toEqual(["Line one", "Line two"]);
  });

  it("preserves blank paragraphs from consecutive newlines", () => {
    const lines = wrapLines("First\n\nThird", font({ size: 20 }), 2000, measurer);
    expect(lines).toEqual(["First", "", "Third"]);
  });

  it("breaks a single word longer than the max width by character", () => {
    // Each char at size 40 = 22 wide; maxWidth 100 -> 4 chars per chunk (88 <= 100, 5th char would be 110 > 100).
    const word = "SUPERCALIFRAGILISTIC";
    const lines = wrapLines(word, font({ size: 40 }), 100, measurer);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(measurer.measureWidth(line, font({ size: 40 }))).toBeLessThanOrEqual(100);
    }
    expect(lines.join("")).toBe(word);
  });
});

describe("fitText", () => {
  it("fits at the preferred size when content is short (fixed)", () => {
    const layout = makeFieldLayout({ overflowMode: "fixed", fontSize: 60, maxLines: 2, width: 800, height: 200 });
    const result = fitText("Hello World", layout, measurer);
    expect(result.status).toBe("fits");
    expect(result.fontSize).toBe(60);
    expect(result.requiredLines).toBe(1);
    expect(result.lines).toBe(1);
  });

  it("auto_fit shrinks the font size until the text fits", () => {
    // "HELLO WORLD FOO" as one line needs size <= 400/(15*0.55) = 48.48; stepping down by 2 from 60 lands on 48.
    const layout = makeFieldLayout({
      overflowMode: "auto_fit",
      fontSize: 60,
      minFontSize: 20,
      maxLines: 1,
      width: 400,
      height: 200,
    });
    const result = fitText("HELLO WORLD FOO", layout, measurer);
    expect(result.status).not.toBe("overflow");
    expect(result.fontSize).toBe(48);
    expect(result.fontSize).toBeLessThan(60);
    expect(result.requiredLines).toBe(1);
  });

  it("auto_fit reports tight when the shrunk line nearly fills the width", () => {
    const layout = makeFieldLayout({
      overflowMode: "auto_fit",
      fontSize: 60,
      minFontSize: 20,
      maxLines: 1,
      width: 400,
      height: 200,
    });
    // At size 48 the single line is 396px wide (> 90% of 400) — tight even though far from minFontSize.
    const result = fitText("HELLO WORLD FOO", layout, measurer);
    expect(result.status).toBe("tight");
  });

  it("auto_fit still overflows when even the minimum font size doesn't fit", () => {
    const layout = makeFieldLayout({
      overflowMode: "auto_fit",
      fontSize: 60,
      minFontSize: 50,
      maxLines: 1,
      width: 400,
      height: 200,
    });
    const result = fitText("HELLO WORLD FOO", layout, measurer);
    expect(result.status).toBe("overflow");
    expect(result.fontSize).toBe(50);
    expect(result.reason).toBe("min_font_size");
  });

  it("fixed mode overflows with reason max_lines when wrapping needs more lines than allowed", () => {
    const layout = makeFieldLayout({ overflowMode: "fixed", fontSize: 40, maxLines: 1, width: 300, height: 500 });
    const result = fitText("HELLO WORLD FOO BAR", layout, measurer);
    expect(result.status).toBe("overflow");
    expect(result.reason).toBe("max_lines");
    expect(result.fontSize).toBe(40); // fixed never shrinks
    expect(result.requiredLines).toBeGreaterThan(1);
  });

  it("fixed mode overflows with reason height when the block is too tall", () => {
    const layout = makeFieldLayout({ overflowMode: "fixed", fontSize: 100, maxLines: 5, width: 2000, height: 50 });
    const result = fitText("One line of text", layout, measurer);
    // 1 line at lineHeight 1.1 * 100 = 110 > height 50.
    expect(result.status).toBe("overflow");
    expect(result.reason).toBe("height");
  });

  it("flex_height allows exceeding the box height but still enforces maxLines", () => {
    const layout = makeFieldLayout({ overflowMode: "flex_height", fontSize: 40, maxLines: 3, width: 2000, height: 10 });
    const fitsHeightOverflow = fitText("One line of text", layout, measurer);
    expect(fitsHeightOverflow.status).not.toBe("overflow"); // height alone doesn't block flex_height

    const tooManyLines = fitText("HELLO WORLD FOO BAR", { ...layout, width: 300, maxLines: 1 }, measurer);
    expect(tooManyLines.status).toBe("overflow");
    expect(tooManyLines.reason).toBe("max_lines");
  });

  it("respects explicit newlines as forced breaks", () => {
    const layout = makeFieldLayout({ overflowMode: "fixed", fontSize: 40, maxLines: 2, width: 2000, height: 500 });
    const result = fitText("Line one\nLine two", layout, measurer);
    expect(result.status).toBe("fits");
    expect(result.requiredLines).toBe(2);
  });
});

describe("layoutLines — alignment and positioning", () => {
  const layout = makeFieldLayout({
    overflowMode: "fixed",
    fontSize: 40,
    maxLines: 1,
    x: 100,
    y: 200,
    width: 800,
    height: 100,
    alignment: "left",
  });

  it("left-aligns at the field's x", () => {
    const result = layoutLines("Hi", layout, measurer);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].x).toBe(100);
    expect(result.lines[0].y).toBe(200);
  });

  it("center-aligns within the field box", () => {
    const result = layoutLines("Hi", { ...layout, alignment: "center" }, measurer);
    const lineWidth = measurer.measureWidth("Hi", font({ size: 40 }));
    expect(result.lines[0].x).toBeCloseTo(100 + (800 - lineWidth) / 2);
  });

  it("right-aligns within the field box", () => {
    const result = layoutLines("Hi", { ...layout, alignment: "right" }, measurer);
    const lineWidth = measurer.measureWidth("Hi", font({ size: 40 }));
    expect(result.lines[0].x).toBeCloseTo(100 + (800 - lineWidth));
  });

  it("stacks multiple lines top-aligned using lineHeight", () => {
    const twoLine = makeFieldLayout({
      overflowMode: "fixed",
      fontSize: 40,
      lineHeight: 1.2,
      maxLines: 2,
      x: 0,
      y: 50,
      width: 2000,
      height: 500,
    });
    const result = layoutLines("Line one\nLine two", twoLine, measurer);
    expect(result.lines[0].y).toBe(50);
    expect(result.lines[1].y).toBe(50 + 40 * 1.2);
  });

  it("drops lines beyond maxLines even in flex_height mode", () => {
    const capped = makeFieldLayout({ overflowMode: "flex_height", fontSize: 20, maxLines: 1, width: 2000, height: 10 });
    const result = layoutLines("Line one\nLine two\nLine three", capped, measurer);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].text).toBe("Line one");
  });

  it("applies uppercase text-transform before measuring and positioning", () => {
    const upper = makeFieldLayout({ overflowMode: "fixed", fontSize: 40, maxLines: 1, textTransform: "uppercase" });
    const result = layoutLines("hi", upper, measurer);
    expect(result.lines[0].text).toBe("HI");
  });
});

describe("fitSlide + computeSlideLayout", () => {
  it("flags missing required fields and marks the slide non-exportable", () => {
    const headlineField = makeTemplateField({ fieldKey: "headline", required: true, maxLines: 1, width: 800 });
    const line1Field = makeTemplateField({ fieldKey: "line1", required: false, maxLines: 1, width: 800 });
    const template = makeTemplate([headlineField, line1Field]);
    const slide = makeSlide({ headline: "", content: {} });

    const result = fitSlide(template, slide, measurer);
    expect(result.missingRequired).toEqual(["headline"]);
    expect(result.exportable).toBe(false);
    expect(result.fields).toHaveLength(2);
  });

  it("is exportable when every field fits and no required field is empty", () => {
    const headlineField = makeTemplateField({ fieldKey: "headline", required: true, maxLines: 1, width: 800 });
    const template = makeTemplate([headlineField]);
    const slide = makeSlide({ headline: "Welcome" });

    const result = fitSlide(template, slide, measurer);
    expect(result.exportable).toBe(true);
    expect(result.missingRequired).toEqual([]);
  });

  it("is not exportable when a field overflows", () => {
    const headlineField = makeTemplateField({
      fieldKey: "headline",
      required: true,
      overflowMode: "fixed",
      maxLines: 1,
      width: 100,
      fontSize: 80,
    });
    const template = makeTemplate([headlineField]);
    const slide = makeSlide({ headline: "This headline is far too long for one line" });

    const result = fitSlide(template, slide, measurer);
    expect(result.exportable).toBe(false);
    expect(result.fields[0].status).toBe("overflow");
  });

  it("computeSlideLayout keys results by fieldKey and matches fitText/layoutLines", () => {
    const headline = makeFieldLayout({ fieldKey: "headline", maxLines: 1, width: 800, fontSize: 60 });
    const line1 = makeFieldLayout({ fieldKey: "line1", maxLines: 1, width: 800, fontSize: 40 });
    const layout = computeSlideLayout(
      { fields: [headline, line1], content: { headline: "Welcome", line1: "Mercredi" } },
      measurer,
    );

    expect(Object.keys(layout).sort()).toEqual(["headline", "line1"]);
    expect(layout.headline.fontSize).toBe(60);
    expect(layout.headline.lines[0].text).toBe("Welcome");
    expect(layout.line1.lines[0].text).toBe("Mercredi");
    expect(layout.headline.fit.fieldKey).toBe("headline");
  });
});

describe("inline bold / italic runs", () => {
  it("strips markers from the plain text and keeps them out of wrapping decisions", () => {
    const lines = wrapLines("avec _vous_ *ici*", font({ size: 40 }), 800, measurer);
    expect(lines).toEqual(["avec vous ici"]);
  });

  it("lays out runs with their own style and concatenates back to the line", () => {
    const field = makeFieldLayout({ width: 1200, fontSize: 40, alignment: "left" });
    const { lines } = layoutLines("*ÉTUDE BIBLIQUE* 19H00 À 20H00", field, measurer);
    expect(lines).toHaveLength(1);
    const runs = lines[0].runs;
    expect(runs.map((r) => [r.text, r.bold, r.italic])).toEqual([
      ["ÉTUDE BIBLIQUE ", true, false],
      ["19H00 À 20H00", false, false],
    ]);
    expect(runs.map((r) => r.text).join("")).toBe(lines[0].text);
    expect(lines[0].width).toBeCloseTo(runs.reduce((sum, r) => sum + r.width, 0));
  });

  it("keeps a style open across a wrapped line", () => {
    const field = makeFieldLayout({ width: 300, fontSize: 40, maxLines: 3, overflowMode: "fixed", height: 400 });
    const { lines } = layoutLines("_HELLO WORLD FOO_", field, measurer);
    expect(lines.map((l) => l.text)).toEqual(["HELLO WORLD", "FOO"]);
    expect(lines.every((l) => l.runs.every((r) => r.italic))).toBe(true);
  });

  it("leaves e-mails, snake_case and lone markers alone", () => {
    const lines = wrapLines("secretariat_eajc@gmail.com * _ snake_case", font({ size: 20 }), 2000, measurer);
    expect(lines).toEqual(["secretariat_eajc@gmail.com * _ snake_case"]);
  });

  it("allows trailing punctuation after a closing marker", () => {
    const field = makeFieldLayout({ width: 1200, fontSize: 40 });
    const { lines } = layoutLines("Je suis avec _vous_.", field, measurer);
    expect(lines[0].text).toBe("Je suis avec vous.");
    expect(lines[0].runs.at(-1)?.italic).toBe(true);
  });
});

describe("image fields and default values", () => {
  it("never fits or lays out an image field", () => {
    const field = makeFieldLayout({ fieldKey: "photo", fieldType: "image", required: true });
    expect(fitText("", field, measurer).status).toBe("fits");
    expect(layoutLines("slides/x.jpg", field, measurer).lines).toEqual([]);
  });

  it("locked fields always show the template default; editable ones only when the slide has no entry", () => {
    const locked = makeTemplateField({ fieldKey: "brand", teamEditable: false, defaultValue: "EAJC", required: false });
    const editable = makeTemplateField({ fieldKey: "line1", teamEditable: true, defaultValue: "Default", required: false });
    const template = makeTemplate([locked, editable]);
    const untouched = fitSlide(template, makeSlide({ content: { brand: "ignored" } }), measurer);
    expect(untouched.exportable).toBe(true);
    const layout = computeSlideLayout(
      { fields: template.fields, content: { brand: "ignored", line1: "" } },
      measurer,
    );
    expect(layout.line1.lines.map((l) => l.text)).toEqual([""]);
    expect(buildContentMap(makeSlide({ content: { brand: "ignored" } }), template.fields)).toEqual({
      headline: "",
      brand: "EAJC",
      line1: "Default",
    });
    expect(buildContentMap(makeSlide({ content: { line1: "" } }), template.fields).line1).toBe("");
  });
});
