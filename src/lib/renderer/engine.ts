/**
 * Pure text-fitting + layout engine — the single deterministic implementation shared by:
 *  - the browser preview (called directly from React, with a canvas-based measurer)
 *  - the server JPG renderer (this exact module is bundled and injected into the headless
 *    Chromium page and re-run there with an in-page canvas measurer)
 *
 * IMPORTANT: this module must have ZERO value imports (types only, via `import type`,
 * which TypeScript erases at compile time) — `scripts/build-engine-bundle.ts` bundles it
 * standalone. Keep every function a top-level `export function` for the same reason.
 *
 * Inline styling: field text may carry lightweight markup — `*bold*` and `_italic_`
 * around whole words (`avec _vous_`, `*ÉTUDE BIBLIQUE* 19H00`). Markers are only
 * recognised at word boundaries, so e-mails, URLs and snake_case stay literal. A bold
 * run renders at weight 700 (or the field's own weight if heavier); an italic run
 * renders italic. Measurement uses the same per-run fonts, so wrapping stays exact.
 */
import type {
  FieldLayout,
  FieldLayoutResult,
  FontSpec,
  LayoutLine,
  LayoutRun,
  SlideLayoutField,
  SlideLayoutInput,
  SlideLayoutMap,
  StyledWord,
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

/** The font a styled run is measured and drawn with: bold lifts to 700, italic forces italic. */
export function styledFont(font: FontSpec, bold: boolean, italic: boolean): FontSpec {
  if (!bold && !italic) return font;
  return {
    family: font.family,
    size: font.size,
    weight: bold ? Math.max(700, font.weight) : font.weight,
    style: italic ? "italic" : font.style,
    letterSpacing: font.letterSpacing,
  };
}

/**
 * Splits one paragraph into words carrying their bold/italic state. `*` toggles bold and
 * `_` toggles italic, only when they open a word or close it (trailing punctuation
 * allowed: `_vous_,`). A lone marker is literal text.
 */
export function parseStyledWords(paragraph: string): StyledWord[] {
  const words = paragraph.split(/\s+/).filter((w) => w.length > 0);
  const out: StyledWord[] = [];
  let bold = false;
  let italic = false;

  for (const raw of words) {
    if (raw === "*" || raw === "_") {
      out.push({ text: raw, bold, italic });
      continue;
    }
    const match = /^([*_]*)([\s\S]*?)([*_]*)([.,;:!?»)\]]*)$/.exec(raw);
    const leading = match ? match[1] : "";
    const core = match ? match[2] : raw;
    const trailing = match ? match[3] : "";
    const punct = match ? match[4] : "";
    if (core === "") {
      // Only markers (and maybe punctuation): treat as literal so nothing vanishes.
      out.push({ text: raw, bold, italic });
      continue;
    }
    for (const marker of leading) {
      if (marker === "*") bold = !bold;
      else italic = !italic;
    }
    out.push({ text: core + punct, bold, italic });
    for (const marker of trailing) {
      if (marker === "*") bold = !bold;
      else italic = !italic;
    }
  }
  return out;
}

/** `text` without its inline markup — for titles, filenames and anywhere the text is not rendered. */
export function stripInlineMarkup(text: string): string {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) out.push(plainText(parseStyledWords(paragraph)));
  return out.join("\n");
}

/** Plain text of a styled line — what `wrapLines` and `LayoutLine.text` report. */
export function plainText(words: StyledWord[]): string {
  let text = "";
  for (let i = 0; i < words.length; i += 1) text += (i > 0 ? " " : "") + words[i].text;
  return text;
}

/**
 * Groups consecutive same-styled words into runs. Every run but the last carries its
 * trailing space so the runs concatenate back into the exact rendered line.
 */
export function buildRuns(words: StyledWord[], font: FontSpec, measurer: TextMeasurer): LayoutRun[] {
  const runs: LayoutRun[] = [];
  let current: LayoutRun | null = null;
  for (const word of words) {
    if (current && current.bold === word.bold && current.italic === word.italic) {
      current.text += " " + word.text;
    } else {
      if (current) current.text += " ";
      current = { text: word.text, x: 0, width: 0, bold: word.bold, italic: word.italic };
      runs.push(current);
    }
  }
  let x = 0;
  for (const run of runs) {
    run.x = x;
    run.width = measurer.measureWidth(run.text, styledFont(font, run.bold, run.italic));
    x += run.width;
  }
  return runs;
}

/** Rendered width of a styled line (sum of its runs). */
export function measureWords(words: StyledWord[], font: FontSpec, measurer: TextMeasurer): number {
  if (words.length === 0) return 0;
  const runs = buildRuns(words, font, measurer);
  let width = 0;
  for (const run of runs) width += run.width;
  return width;
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

/**
 * Greedy word wrap honouring explicit `\n`, on styled words. Breaks a single word that
 * alone exceeds `maxWidth` by character (never leaves a word to overflow silently).
 */
export function wrapStyledLines(text: string, font: FontSpec, maxWidth: number, measurer: TextMeasurer): StyledWord[][] {
  const paragraphs = text.split("\n");
  const lines: StyledWord[][] = [];

  for (const paragraph of paragraphs) {
    const words = parseStyledWords(paragraph);
    if (words.length === 0) {
      lines.push([]);
      continue;
    }

    let current: StyledWord[] = [];
    for (const word of words) {
      const wordFont = styledFont(font, word.bold, word.italic);
      const candidate = current.concat([word]);
      if (current.length > 0 && measureWords(candidate, font, measurer) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current.length > 0) lines.push(current);
      current = [];
      if (measurer.measureWidth(word.text, wordFont) > maxWidth) {
        const chunks = breakWordByChar(word.text, wordFont, maxWidth, measurer);
        for (let i = 0; i < chunks.length - 1; i += 1) lines.push([{ text: chunks[i], bold: word.bold, italic: word.italic }]);
        current = [{ text: chunks[chunks.length - 1], bold: word.bold, italic: word.italic }];
      } else {
        current = [word];
      }
    }
    lines.push(current);
  }

  return lines;
}

/** Plain-text view of `wrapStyledLines` (markup stripped, one string per line). */
export function wrapLines(text: string, font: FontSpec, maxWidth: number, measurer: TextMeasurer): string[] {
  const styled = wrapStyledLines(text, font, maxWidth, measurer);
  const out: string[] = [];
  for (const line of styled) out.push(plainText(line));
  return out;
}

/** `tight` when the result only just fits: at/near the minimum font size, or a full-width last line at the max-lines limit. */
export function computeFitStatus(
  lines: StyledWord[][],
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
    const lastWidth = measureWords(last, font, measurer);
    if (lastWidth > width * 0.9) return "tight";
  }
  return "fits";
}

interface Attempt {
  lines: StyledWord[][];
  font: FontSpec;
  lineHeightPx: number;
  totalHeight: number;
}

export function attemptAt(text: string, layout: FieldLayout, size: number, measurer: TextMeasurer): Attempt {
  const font = fontAt(layout, size);
  const lines = wrapStyledLines(text, font, layout.width, measurer);
  const lineHeightPx = size * layout.lineHeight;
  return { lines, font, lineHeightPx, totalHeight: lines.length * lineHeightPx };
}

export function emptyFit(fieldKey: string): TextFitResult {
  return { fieldKey, status: "fits", fontSize: 0, lines: 0, requiredLines: 0 };
}

/**
 * Fits `text` into `layout` per its `overflowMode`:
 *  - `fixed`: preferred size only; overflow if it needs more than `maxLines`, or the
 *    required block height exceeds the field height.
 *  - `auto_fit`: steps the font size down from `fontSize` to `minFontSize` in 2px
 *    increments until it fits; overflow if it still doesn't fit at `minFontSize`.
 *  - `flex_height`: preferred size, allowed to exceed the field height, but `maxLines`
 *    is still a hard limit.
 * Image fields carry no text and always fit.
 */
export function fitText(text: string, layout: FieldLayout, measurer: TextMeasurer): TextFitResult {
  if (layout.fieldType === "image") return emptyFit(layout.fieldKey);
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
  if (layout.fieldType === "image") return { fontSize: 0, lines: [] };
  const fit = fitText(text, layout, measurer);
  const transformed = applyTextTransform(text, layout.textTransform);
  const font = fontAt(layout, fit.fontSize);
  let lines = wrapStyledLines(transformed, font, layout.width, measurer);
  if (lines.length > layout.maxLines) lines = lines.slice(0, layout.maxLines);

  const lineHeightPx = fit.fontSize * layout.lineHeight;
  const positioned: LayoutLine[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const words = lines[index];
    const runs = buildRuns(words, font, measurer);
    let lineWidth = 0;
    for (const run of runs) lineWidth += run.width;
    let x = layout.x;
    if (layout.alignment === "center") x = layout.x + (layout.width - lineWidth) / 2;
    else if (layout.alignment === "right") x = layout.x + (layout.width - lineWidth);
    positioned.push({ text: plainText(words), x, y: layout.y + index * lineHeightPx, width: lineWidth, runs });
  }

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
