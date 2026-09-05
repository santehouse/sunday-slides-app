import "server-only";

/**
 * Server-side JPEG rendering: a headless Chromium screenshot of the exact same
 * `SlideCanvas` markup the browser preview uses. See docs/RENDERING.md for the full
 * parity story. High-level flow per slide:
 *
 *  1. `renderToStaticMarkup(<SlideCanvas .../>)` with an EMPTY layout map — this gives a
 *     static HTML shell with the background + overlay layers already correct (they need
 *     no text measurement) and an empty `[data-slide-canvas]` root, no text yet.
 *  2. That shell is wrapped into a full HTML document with every font the template needs
 *     inlined as base64 `@font-face` rules (no network fetch from inside the page).
 *  3. The pure engine (`./engine.ts`) and measurer (`./measure.ts`) — both zero-import
 *     modules — are injected into a `<script>` tag as a prebuilt esbuild IIFE
 *     (`engine.bundle.generated.ts`), because Node has no `<canvas>` to measure text with. Node cannot run
 *     `computeSlideLayout` itself for that reason; the headless page runs it instead,
 *     after `ensureFontsLoaded`, with its own real canvas measurer — the SAME algorithm
 *     the browser preview calls directly.
 *  4. The in-page script appends one absolutely positioned `<div>` per computed line
 *     directly under `[data-slide-canvas]`, mirroring `GenericRenderer`'s own line
 *     styling, then flags `window.__layoutDone` and hands back each field's fit result.
 *  5. Node waits for that flag and screenshots the exact 1920×1080 clip.
 */
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import path from "node:path";
import type { Browser } from "puppeteer-core";
import { SlideCanvas, buildFontFaceCss } from "./SlideCanvas";
import { buildContentMap, buildSlideFitResult, buildSlideLayoutInput } from "./fitText";
import { ENGINE_BUNDLE } from "./engine.bundle.generated";
import { SLIDE_HEIGHT, SLIDE_WIDTH } from "./types";
import type { FieldLayout, RenderSlideInput, RenderedSlide, ResolvedFont, TextFitResult } from "./types";

// ---------------------------------------------------------------------------
// Browser lifecycle — one Chromium instance reused across renders within (and,
// opportunistically, across) requests. Closed and cleared on any render error so a
// wedged browser never poisons the next call.
// ---------------------------------------------------------------------------

let cachedBrowser: Browser | null = null;

function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL) || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function listDirs(baseDir: string, prefix: string): string[] {
  try {
    return fs
      .readdirSync(baseDir)
      .filter((name) => name.startsWith(prefix))
      .map((name) => path.join(baseDir, name))
      .sort();
  } catch {
    return [];
  }
}

/** Resolves a local Chromium/Chrome binary for `pnpm dev` and CI — never used in Vercel/Lambda. */
function resolveLocalExecutablePath(): string {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;

  const candidates = [
    ...listDirs("/opt/pw-browsers", "chromium-").map((dir) => path.join(dir, "chrome-linux", "chrome")),
    ...listDirs("/opt/pw-browsers", "chromium_headless_shell-").map((dir) =>
      path.join(dir, "chrome-linux", "headless_shell"),
    ),
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error(
    "renderSlideToJpeg: no local Chromium executable found. Set PUPPETEER_EXECUTABLE_PATH, or install one under " +
      "/opt/pw-browsers, /usr/bin/chromium, or /usr/bin/google-chrome.",
  );
}

async function launchBrowser(): Promise<Browser> {
  const { launch } = await import("puppeteer-core");

  if (isServerlessRuntime()) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
      defaultViewport: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT, deviceScaleFactor: 1 },
    });
  }

  return launch({
    executablePath: resolveLocalExecutablePath(),
    headless: true,
    // Chromium refuses to start as root without this (common in containerized dev/CI
    // environments) — only added when actually running as root, never in production
    // where the serverless branch above (with its own sandboxed args) is used instead.
    args: typeof process.getuid === "function" && process.getuid() === 0 ? ["--no-sandbox", "--disable-setuid-sandbox"] : [],
    defaultViewport: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT, deviceScaleFactor: 1 },
  });
}

async function getBrowser(): Promise<Browser> {
  if (cachedBrowser && cachedBrowser.connected) return cachedBrowser;
  const browser = await launchBrowser();
  browser.on("disconnected", () => {
    if (cachedBrowser === browser) cachedBrowser = null;
  });
  cachedBrowser = browser;
  return browser;
}

async function closeBrowser(): Promise<void> {
  const browser = cachedBrowser;
  cachedBrowser = null;
  if (!browser) return;
  try {
    await browser.close();
  } catch {
    // Already gone — nothing to clean up.
  }
}

// ---------------------------------------------------------------------------
// The pure engine + canvas measurer are pre-bundled by `pnpm engine:bundle` (esbuild) into
// engine.bundle.generated.ts and injected into the headless page verbatim. This survives any
// production minifier, unlike stringifying functions at runtime.
// ---------------------------------------------------------------------------

function engineScript(): string {
  return ENGINE_BUNDLE;
}

function collectFontsToLoad(fields: FieldLayout[]): { family: string; weight: number; style: string }[] {
  const seen = new Set<string>();
  const specs: { family: string; weight: number; style: string }[] = [];
  for (const field of fields) {
    const key = `${field.fontFamily}|${field.fontWeight}|${field.fontStyle}`;
    if (seen.has(key)) continue;
    seen.add(key);
    specs.push({ family: field.fontFamily, weight: field.fontWeight, style: field.fontStyle });
  }
  return specs;
}

// ---------------------------------------------------------------------------
// Font inlining — Arimo/Tinos from public/fonts (latin + latin-ext, the two subsets that
// cover every FR-CA/EN character our slide content uses, œ/Œ included), custom or other
// Google fonts from their resolved URL, all embedded as base64 `data:` URIs so the page
// never makes an outside request for a font.
// ---------------------------------------------------------------------------

const SELF_HOSTED_FAMILIES = new Set(["Arimo", "Tinos"]);
const SELF_HOSTED_SUBSETS = new Set(["latin", "latin-ext"]);

interface ParsedFontFace {
  subset: string;
  style: string;
  weight: number;
  srcPath: string;
  unicodeRange: string;
}

function parseFontCss(cssText: string): ParsedFontFace[] {
  const entries: ParsedFontFace[] = [];
  const blockRegex = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*{([^}]*)}/g;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(cssText))) {
    const [, subset, body] = match;
    const style = /font-style:\s*([a-z]+)/.exec(body)?.[1] ?? "normal";
    const weight = Number(/font-weight:\s*(\d+)/.exec(body)?.[1] ?? "400");
    const srcPath = /url\(([^)]+)\)/.exec(body)?.[1]?.trim() ?? "";
    const unicodeRange = /unicode-range:\s*([^;]+);/.exec(body)?.[1]?.trim() ?? "";
    entries.push({ subset, style, weight, srcPath, unicodeRange });
  }
  return entries;
}

const fontCssCache = new Map<string, ParsedFontFace[]>();
async function loadSelfHostedFontCss(family: string): Promise<ParsedFontFace[]> {
  const cached = fontCssCache.get(family);
  if (cached) return cached;
  const cssPath = path.join(process.cwd(), "public", "fonts", `${family.toLowerCase()}.css`);
  const cssText = await fsp.readFile(cssPath, "utf8");
  const entries = parseFontCss(cssText);
  fontCssCache.set(family, entries);
  return entries;
}

const fontFileCache = new Map<string, string>();
async function base64PublicFile(publicRelativeUrl: string): Promise<string> {
  const cached = fontFileCache.get(publicRelativeUrl);
  if (cached) return cached;
  const filePath = path.join(process.cwd(), "public", publicRelativeUrl.replace(/^\//, ""));
  const buf = await fsp.readFile(filePath);
  const b64 = buf.toString("base64");
  fontFileCache.set(publicRelativeUrl, b64);
  return b64;
}

/** Arimo/Tinos ship as static 400/700 weights; anything requested in between snaps to the nearer one. */
function nearestSelfHostedWeight(weight: number): number {
  return weight >= 600 ? 700 : 400;
}

async function inlineSelfHostedFont(family: string, fields: FieldLayout[]): Promise<string> {
  const entries = await loadSelfHostedFontCss(family);
  const combos = new Map<string, { weight: number; style: string }>();
  for (const field of fields) {
    const weight = nearestSelfHostedWeight(field.fontWeight);
    combos.set(`${weight}|${field.fontStyle}`, { weight, style: field.fontStyle });
  }

  const blocks: string[] = [];
  for (const { weight, style } of combos.values()) {
    const matches = entries.filter(
      (entry) => entry.weight === weight && entry.style === style && SELF_HOSTED_SUBSETS.has(entry.subset),
    );
    for (const entry of matches) {
      const b64 = await base64PublicFile(entry.srcPath);
      blocks.push(
        `@font-face { font-family: "${family}"; font-style: ${entry.style}; font-weight: ${entry.weight}; ` +
          `font-display: block; src: url(data:font/woff2;base64,${b64}) format("woff2"); ` +
          `unicode-range: ${entry.unicodeRange}; }`,
      );
    }
  }
  return blocks.join("\n");
}

async function inlineCustomFonts(fonts: ResolvedFont[]): Promise<string> {
  const inlined: ResolvedFont[] = [];
  for (const resolved of fonts) {
    if (resolved.url.startsWith("data:")) {
      inlined.push(resolved);
      continue;
    }
    const res = await fetch(resolved.url);
    if (!res.ok) {
      throw new Error(`server.ts: failed to fetch font "${resolved.font.family}" (${resolved.url}): HTTP ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = resolved.url.toLowerCase().endsWith(".woff") ? "font/woff" : "font/woff2";
    inlined.push({ ...resolved, url: `data:${mime};base64,${buf.toString("base64")}` });
  }
  return buildFontFaceCss(inlined);
}

async function buildInlineFontFaceCss(input: RenderSlideInput): Promise<string> {
  const families = new Set(input.template.fields.map((f) => f.fontFamily));
  const parts: string[] = [];

  for (const family of families) {
    if (SELF_HOSTED_FAMILIES.has(family)) {
      const fields = input.template.fields.filter((f) => f.fontFamily === family);
      parts.push(await inlineSelfHostedFont(family, fields));
    }
  }

  const customFonts = input.fonts.filter((f) => !SELF_HOSTED_FAMILIES.has(f.font.family));
  if (customFonts.length > 0) {
    parts.push(await inlineCustomFonts(customFonts));
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Document assembly + the render itself.
// ---------------------------------------------------------------------------

function escapeForInlineScript(json: string): string {
  // Prevents a literal "</script>" inside JSON string content from closing the tag early.
  return json.replace(/</g, "\\u003c");
}

async function buildDocument(input: RenderSlideInput): Promise<string> {
  // Dynamically imported (rather than a static top-level `import`) so Next's build
  // doesn't flag this module — which a Route Handler imports — as pulling
  // "react-dom/server" into the App Router's RSC graph. It isn't: this call has nothing
  // to do with Next's own SSR/RSC pipeline, it's building a standalone HTML string for
  // headless Chromium to load and screenshot.
  const { renderToStaticMarkup } = await import("react-dom/server");

  const layoutInput = buildSlideLayoutInput(input.template, input.slide);
  const fontFaceCss = await buildInlineFontFaceCss(input);
  const shellMarkup = renderToStaticMarkup(SlideCanvas({ input, layouts: {} }));
  const fontsToLoad = collectFontsToLoad(layoutInput.fields);

  const layoutInputJson = escapeForInlineScript(JSON.stringify(layoutInput));
  const fontsToLoadJson = escapeForInlineScript(JSON.stringify(fontsToLoad));

  const driverScript = `
(function () {
  var layoutInput = ${layoutInputJson};
  var fontsToLoad = ${fontsToLoadJson};
  var fieldsByKey = {};
  layoutInput.fields.forEach(function (f) { fieldsByKey[f.fieldKey] = f; });

  window.__engine.ensureFontsLoaded(fontsToLoad, document).then(function () {
    var measurer = window.__engine.createCanvasMeasurer(document);
    var layoutMap = window.__engine.computeSlideLayout(layoutInput, measurer);
    var root = document.querySelector("[data-slide-canvas]");

    Object.keys(layoutMap).forEach(function (fieldKey) {
      var field = fieldsByKey[fieldKey];
      var fieldResult = layoutMap[fieldKey];
      fieldResult.lines.forEach(function (line) {
        var div = document.createElement("div");
        div.textContent = line.text;
        div.style.position = "absolute";
        div.style.left = line.x + "px";
        div.style.top = line.y + "px";
        div.style.fontFamily = '"' + field.fontFamily + '", sans-serif';
        div.style.fontSize = fieldResult.fontSize + "px";
        div.style.fontWeight = String(field.fontWeight);
        div.style.fontStyle = field.fontStyle;
        div.style.letterSpacing = field.letterSpacing + "px";
        div.style.color = field.textColor;
        div.style.lineHeight = "1";
        div.style.whiteSpace = "pre";
        root.appendChild(div);
      });
    });

    window.__fitResult = layoutInput.fields.map(function (f) { return layoutMap[f.fieldKey].fit; });
    window.__layoutDone = true;
  }).catch(function (err) {
    window.__layoutError = String((err && err.stack) || err);
    window.__layoutDone = true;
  });
})();`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
html, body { margin: 0; padding: 0; background: #000000; }
${fontFaceCss}
</style>
</head>
<body>
${shellMarkup}
<script>${engineScript()}</script>
<script>${driverScript}</script>
</body>
</html>`;
}

interface PageLayoutGlobals {
  __layoutDone?: boolean;
  __layoutError?: string;
  __fitResult?: TextFitResult[];
}

async function renderOne(browser: Browser, input: RenderSlideInput): Promise<RenderedSlide> {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: SLIDE_WIDTH, height: SLIDE_HEIGHT, deviceScaleFactor: 1 });
    const html = await buildDocument(input);
    await page.setContent(html, { waitUntil: "load" });
    await page.waitForFunction(() => (window as unknown as PageLayoutGlobals).__layoutDone === true, {
      timeout: 15_000,
    });

    const layoutError = await page.evaluate(() => (window as unknown as PageLayoutGlobals).__layoutError);
    if (layoutError) {
      throw new Error(`renderSlideToJpeg: in-page layout failed for slide "${input.slide.id}": ${layoutError}`);
    }

    const fitFields = await page.evaluate(
      () => (window as unknown as PageLayoutGlobals).__fitResult as TextFitResult[],
    );

    const jpegBuffer = await page.screenshot({
      type: "jpeg",
      quality: 92,
      clip: { x: 0, y: 0, width: SLIDE_WIDTH, height: SLIDE_HEIGHT },
      omitBackground: false,
    });

    const layoutInput = buildSlideLayoutInput(input.template, input.slide);
    const fit = buildSlideFitResult(
      input.slide.id,
      layoutInput.fields,
      buildContentMap(input.slide),
      fitFields,
    );

    return { jpeg: new Uint8Array(jpegBuffer), width: SLIDE_WIDTH, height: SLIDE_HEIGHT, fit };
  } finally {
    await page.close();
  }
}

/** Renders one slide to a 1920×1080 JPEG, reusing the shared headless Chromium instance. */
export async function renderSlideToJpeg(input: RenderSlideInput): Promise<RenderedSlide> {
  const [result] = await renderSlidesToJpegs([input]);
  return result;
}

/**
 * Renders many slides, reusing one Chromium instance across all of them. On any error the
 * browser is closed (so a wedged page/context never poisons the next request) and the
 * error is re-thrown.
 */
export async function renderSlidesToJpegs(
  inputs: RenderSlideInput[],
  onProgress?: (done: number, total: number) => void,
): Promise<RenderedSlide[]> {
  const browser = await getBrowser();
  const results: RenderedSlide[] = [];
  try {
    for (let i = 0; i < inputs.length; i += 1) {
      results.push(await renderOne(browser, inputs[i]));
      onProgress?.(i + 1, inputs.length);
    }
    return results;
  } catch (err) {
    await closeBrowser();
    throw err;
  }
}
