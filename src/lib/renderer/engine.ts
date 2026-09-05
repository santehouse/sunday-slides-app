/**
 * Pure text-fitting + layout engine — the single deterministic implementation shared by:
 *  - the browser preview (called directly from React, with a canvas-based measurer)
 *  - the server JPG renderer (this exact module's compiled source is inlined into the
 *    headless Chromium page and re-run there with an in-page canvas measurer)
 *
 * IMPORTANT: this module must have ZERO value imports (types only, via `import type`,
 * which TypeScript erases at compile time). `src/lib/renderer/server.ts` reads every
 * exported `function` declaration here with `Function.prototype.toString` and inlines
 * their source into the headless page — a value import would not exist there.
 *
 * For the same reason every function that participates in this graph (including
 * internal helpers) is declared with `export function name(...) {}` — never as an
 * arrow function assigned to a `const` — so its declared name survives minification
 * and can be recovered from its own source text. See `buildEngineScript` in server.ts.
 */
import type {
  FieldLayout,
  FieldLayoutResult,
  FontSpec,
  SlideLayoutField,
  SlideLayoutInput,
  SlideLayoutMap,
  TextFitResult,
  TextFitStatus,
  TextMeasurer,
} from "./types";

/** Applies the field's `textTransform` before any measuring happens. */
export function applyTextTransform(text: string, transform: FieldLayout["textTransform"]): string {
  return transform === "uppercase" ? text.toUpperCase() : text;
}

export function fontAt(layout: FieldLayout, size: number): FontSpec {
  return {
    family: layout.fontFamily,
    size,
    weight: layout.fontWeight,
    style: layout.fontStyle,
    letterSpacing: layout.letterSpacing,
  };
}

/**
 * Greedy word wrap honouring explicit `\n`. Breaks a single word that alone exceeds
 * `maxWidth` by character (never leaves a word to overflow silently).
 */
export function wrapLines(text: string, font: FontSpec, maxWidth: number, measurer: TextMeasurer): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let current = "";
    for (const word of words) {
      if (current === "") {
        if (measurer.measureWidth(word, font) > maxWidth) {
          const chunks = breakWordByChar(word, font, maxWidth, measurer);
          for (let i = 0; i < chunks.length - 1; i += 1) lines.push(chunks[i]);
          current = chunks[chunks.length - 1];
        } else {
          current = word;
        }
        continue;
      }

      const candidate = `${current} ${word}`;
      if (measurer.measureWidth(candidate, font) <= maxWidth) {
        current = candidate;
        continue;
      }

      lines.push(current);
      if (measurer.measureWidth(word, font) > maxWidth) {
        const chunks = breakWordByChar(word, font, maxWidth, measurer);
        for (let i = 0; i < chunks.length - 1; i += 1) lines.push(chunks[i]);
        current = chunks[chunks.length - 1];
      } else {
        current = word;
      }
    }
    lines.push(current);
  }

  return lines;
}

/** Greedily packs characters of a single long word into chunks no wider than `maxWidth`. */
export function breakWordByChar(word: string, font: FontSpec, maxWidth: number, measurer: TextMeasurer): string[] {
  const chars = Array.from(word);
  const chunks: string[] = [];
  let current = "";

  for (const ch of chars) {
    const candidate = current + ch;
    if (current === "" || measurer.measureWidth(candidate, font) <= maxWidth) {
      current = candidate;
    } else {
      chunks.push(current);
      current = ch;
    }
  }
  if (current !== "" || chunks.length === 0) chunks.push(current);
  return chunks;
}

/** `tight` when the result only just fits: at/near the minimum font size, or a full-width last line at the max-lines limit. */
export function computeFitStatus(
  lines: string[],
  requiredLines: number,
  maxLines: number,
  width: number,
  font: FontSpec,
  measurer: TextMeasurer,
  minFontSize: number,
): TextFitStatus {
  if (font.size <= minFontSize + 4) return "tight";
  if (requiredLines === maxLines && lines.length > 0) {
    const last = lines[lines.length - 1];
    const lastWidth = measurer.measureWidth(last, font);
    if (lastWidth > width * 0.9) return "tight";
  }
  return "fits";
}

interface Attempt {
  lines: string[];
  font: FontSpec;
  lineHeightPx: number;
  totalHeight: number;
}

export function attemptAt(text: string, layout: FieldLayout, size: number, measurer: TextMeasurer): Attempt {
  const font = fontAt(layout, size);
  const lines = wrapLines(text, font, layout.width, measurer);
  const lineHeightPx = size * layout.lineHeight;
  return { lines, font, lineHeightPx, totalHeight: lines.length * lineHeightPx };
}

/**
 * Fits `text` into `layout` per its `overflowMode`:
 *  - `fixed`: preferred size only; overflow if it needs more than `maxLines`, or the
 *    required block height exceeds the field height.
 *  - `auto_fit`: steps the font size down from `fontSize` to `minFontSize` in 2px
 *    increments until it fits; overflow if it still doesn't fit at `minFontSize`.
 *  - `flex_height`: preferred size, allowed to exceed the field height, but `maxLines`
 *    is still a hard limit.
 */
export function fitText(text: string, layout: FieldLayout, measurer: TextMeasurer): TextFitResult {
  const transformed = applyTextTransform(text, layout.textTransform);
  const maxLines = layout.maxLines;

  if (layout.overflowMode === "auto_fit") {
    let size = layout.fontSize;
    let attempt = attemptAt(transformed, layout, size, measurer);

    while (
      (attempt.lines.length > maxLines || attempt.totalHeight > layout.height) &&
      size > layout.minFontSize
    ) {
      size = Math.max(layout.minFontSize, size - 2);
      attempt = attemptAt(transformed, layout, size, measurer);
    }

    const requiredLines = attempt.lines.length;
    const fits = requiredLines <= maxLines && attempt.totalHeight <= layout.height;
    if (!fits) {
      return {
        fieldKey: layout.fieldKey,
        status: "overflow",
        fontSize: size,
        lines: Math.min(requiredLines, maxLines),
        requiredLines,
        reason: size <= layout.minFontSize ? "min_font_size" : requiredLines > maxLines ? "max_lines" : "height",
      };
    }

    const status = computeFitStatus(
      attempt.lines,
      requiredLines,
      maxLines,
      layout.width,
      attempt.font,
      measurer,
      layout.minFontSize,
    );
    return { fieldKey: layout.fieldKey, status, fontSize: size, lines: requiredLines, requiredLines };
  }

  // fixed and flex_height both start (and, for flex_height, stay) at the preferred size.
  const attempt = attemptAt(transformed, layout, layout.fontSize, measurer);
  const requiredLines = attempt.lines.length;

  if (requiredLines > maxLines) {
    return {
      fieldKey: layout.fieldKey,
      status: "overflow",
      fontSize: layout.fontSize,
      lines: maxLines,
      requiredLines,
      reason: "max_lines",
    };
  }

  if (layout.overflowMode === "fixed" && attempt.totalHeight > layout.height) {
    return {
      fieldKey: layout.fieldKey,
      status: "overflow",
      fontSize: layout.fontSize,
      lines: requiredLines,
      requiredLines,
      reason: "height",
    };
  }

  const status = computeFitStatus(
    attempt.lines,
    requiredLines,
    maxLines,
    layout.width,
    attempt.font,
    measurer,
    layout.minFontSize,
  );
  return { fieldKey: layout.fieldKey, status, fontSize: layout.fontSize, lines: requiredLines, requiredLines };
}

/**
 * Computes the font size and the positioned, pre-measured lines for `text` in `layout`
 * — alignment (left/center/right) applied within the field box, vertical top alignment.
 * Lines beyond `maxLines` are dropped (the hard limit for every overflow mode).
 */
export function layoutLines(text: string, layout: FieldLayout, measurer: TextMeasurer): FieldLayoutResult {
  const fit = fitText(text, layout, measurer);
  const transformed = applyTextTransform(text, layout.textTransform);
  const font = fontAt(layout, fit.fontSize);
  let lines = wrapLines(transformed, font, layout.width, measurer);
  if (lines.length > layout.maxLines) lines = lines.slice(0, layout.maxLines);

  const lineHeightPx = fit.fontSize * layout.lineHeight;
  const positioned = lines.map((lineText, index) => {
    const lineWidth = measurer.measureWidth(lineText, font);
    let x = layout.x;
    if (layout.alignment === "center") x = layout.x + (layout.width - lineWidth) / 2;
    else if (layout.alignment === "right") x = layout.x + (layout.width - lineWidth);
    return { text: lineText, x, y: layout.y + index * lineHeightPx, width: lineWidth };
  });

  return { fontSize: fit.fontSize, lines: positioned };
}

/**
 * Lays out every field described in `input` — the single call the browser preview and
 * the in-page server renderer both make (with their respective canvas measurers).
 */
export function computeSlideLayout(input: SlideLayoutInput, measurer: TextMeasurer): SlideLayoutMap {
  const result: SlideLayoutMap = {};
  for (const field of input.fields) {
    const text = input.content[field.fieldKey] ?? "";
    const fit = fitText(text, field, measurer);
    const { fontSize, lines } = layoutLines(text, field, measurer);
    const entry: SlideLayoutField = { fontSize, lines, fit };
    result[field.fieldKey] = entry;
  }
  return result;
}
