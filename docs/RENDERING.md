# Rendering — how parity works, and how to extend it

This is the implementation notes for `src/lib/renderer/**`, `src/lib/exports/**`,
`src/lib/r2/**`, `src/lib/fonts/**`, and `src/app/api/render/**`. Product behaviour is
specified in `docs/BUILD_HANDOFF.md` sections 9, 10, 12, 13, 27, 29, 34, 35, 36 — this
document is about *how* the code delivers that, not what it should do.

## The one rule everything else follows

> Browser preview, JPG export, and MP4 frames must be pixel-identical, because they are
> the same renderer running in two places, never two renderers.

Concretely: line breaks, font sizing, and every pixel position are computed **once**, by
a pure function (`computeSlideLayout` → `fitText` / `layoutLines` / `wrapLines`), and that
same function runs both in the real browser and inside the headless page the server
screenshots. Nothing about layout is duplicated — only the *last* step, turning already-
computed line data into DOM nodes, exists twice (a React tree for the browser, a small
vanilla-JS loop for the headless page), because Node has no `<canvas>` to measure text
with and the headless page does.

## The pieces

```
engine.ts        Pure layout engine. ZERO value imports. wrapLines, fitText,
                 layoutLines, computeSlideLayout, and every helper they call.
measure.ts       createCanvasMeasurer (offscreen <canvas> measurer) + ensureFontsLoaded.
                 Also zero value imports — same reason as engine.ts.
fitText.ts       Domain-aware wrapper: fitSlide(template, slide, measurer), plus
                 buildSlideLayoutInput/buildContentMap/buildSlideFitResult. Re-exports
                 the pure engine functions too. THIS is what other features should
                 import from (Slide Editor's live "text fit" state, Template Studio).
SlideCanvas.tsx  <SlideCanvas input layouts> — background/overlay/text layers (via the
                 renderer registry) + the safe-zone guide. Pure — layouts is always
                 precomputed and passed in, never measured inside the component.
                 <SlideFrame> — client-only ResizeObserver scaling wrapper for previews.
                 buildFontFaceCss(fonts) — @font-face rules for custom/Google fonts.
renderers/       The registry: { "generic-v1": GenericRenderer }. See "Bespoke
                 renderers" below.
server.ts        "server-only". renderSlideToJpeg / renderSlidesToJpegs — headless
                 Chromium screenshot of the exact same markup + engine.
thumbnail.ts     renderTemplateThumbnail — server render with placeholder copy.
exports/jpg.ts   buildJpgExport — one JPEG per slide, ZIP'd when there's more than one.
exports/mp4.ts   buildMp4 — ffmpeg concat-demuxer over the renderer's own JPEG frames.
r2/              R2 (S3-compatible) client + local filesystem fallback + lifecycle.
fonts/resolve.ts Arimo/Tinos → self-hosted files; other Google fonts → fetch once,
                 cache in the object store; custom → signed R2 URL.
api/render/      POST { input: RenderSlideInput } → JPEG (template thumbnails, Add
  preview/       Slide cards, or any caller that wants a one-off export-quality render).
```

## Why `engine.ts` and `measure.ts` have zero imports

`server.ts` cannot run `computeSlideLayout` in Node — there's no `<canvas>` — so it hands
the *exact same code* to the headless page and runs it there instead, after the page's
fonts have loaded. It does this by reading every exported function's own source with
`Function.prototype.toString` and inlining it into a `<script>` tag (see
`buildEngineScript` in `server.ts`). Two things fall out of that:

1. **No value imports.** A function that imports something can't be transplanted this
   way — the import wouldn't exist on the other side. `import type` is fine; it's erased
   at compile time and never appears in the runtime source `toString()` returns.
2. **Every function is `export function name(...) {}` — never `export const name = (...)
   => {}`.** `buildEngineScript` doesn't trust that a function's *export key* matches its
   own name; it recovers the real declared name from the function's own source text,
   specifically so this survives a production server bundle renaming things during
   minification (only named `function` declarations reliably expose their own name this
   way after a minifier runs; an arrow function assigned to a `const` does not). This
   also means **every helper**, not just the four public functions, must be exported —
   otherwise it's invisible to `buildEngineScript` and the inlined script references an
   undefined identifier at the first call site that touches it (this bit us during
   development: `fitText`'s internal `attemptAt` helper and `measure.ts`'s `cssFont`/
   `measurementCacheKey` had to be exported too, not just the four public names).

If you add a helper function to `engine.ts` or `measure.ts`: export it, as a named
`function`, or `server.ts` will throw a clear error at render time telling you which
export it couldn't find a declared name for.

`react-dom/server`'s `renderToStaticMarkup` (used to build the static HTML shell — step 1
below) is imported with a dynamic `await import("react-dom/server")` inside
`buildDocument`, not a static top-level `import`. Turbopack's production build
(`pnpm build`) statically flags any module reachable from an App Route that imports
`react-dom/server` as a likely mistake ("you're importing a component that imports
react-dom/server... render or return the content directly as a Server Component
instead") — a real guard for the common case, but a false positive here: this call has
nothing to do with Next's own SSR/RSC pipeline, it's building a standalone HTML string
for headless Chromium to load. The dynamic import isn't a style preference; the static
form fails `pnpm build` outright.

## How a server render actually happens (`server.ts`)

1. `renderToStaticMarkup(<SlideCanvas input={input} layouts={{}} />)` — an **empty**
   layout map, so this only gives us the background + overlay layers (they need no text
   measurement) plus an empty `[data-slide-canvas]` root. No text yet.
2. That shell is wrapped into a full HTML document: inline `<style>` with every font the
   template needs as a base64 `data:` URI `@font-face` (Arimo/Tinos parsed straight out
   of `public/fonts/arimo.css`/`tinos.css`; anything else fetched from its resolved URL
   once), plus two inline `<script>` tags — the inlined engine, then a small driver.
3. The driver: waits for every needed family/weight/style to actually load
   (`ensureFontsLoaded` — `document.fonts.ready` alone isn't enough, because nothing has
   painted with those fonts yet to *trigger* a load), then calls `computeSlideLayout`
   with a real in-page canvas measurer, then walks the result and appends one absolutely
   positioned `<div>` per line directly under `[data-slide-canvas]` — same inline styles
   `GenericRenderer` itself would produce for the same data. Finally sets
   `window.__layoutDone = true` and `window.__fitResult` (each field's `TextFitResult`).
4. Node's `page.waitForFunction(() => window.__layoutDone === true)`, then
   `page.screenshot({ type: "jpeg", quality: 92, clip: 1920×1080 })`.
5. The fit results come back from the page and are assembled into a `SlideFitResult`
   (`buildSlideFitResult`) — `RenderedSlide.fit` — so callers can block export
   (`exports/jpg.ts` throws `JpgExportBlockedError` if any slide isn't exportable).

Chromium is resolved once per server instance and reused across renders (and across
requests when the runtime keeps the instance warm) — `@sparticuz/chromium` +
`puppeteer-core` when `VERCEL` or `AWS_LAMBDA_FUNCTION_NAME` is set, otherwise
`PUPPETEER_EXECUTABLE_PATH` or the first of `/opt/pw-browsers/chromium-*/chrome-linux/
chrome`, `/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell`,
`/usr/bin/chromium`, `/usr/bin/google-chrome` that exists on disk. It's closed and
cleared on any render error so a wedged page never poisons the next request.

## Exports always render with `showSafeZone: false`

Per section 34 of the handoff doc, the safe-zone guide is editor-only chrome — it must
never appear in a real JPG/MP4. `SlideCanvas` will render it whenever
`input.showSafeZone` is true, so this is enforced at the call site: `exports/jpg.ts`
explicitly overrides `showSafeZone: false` on every slide before rendering, regardless of
what the caller's editor preview happened to be showing. `renderSlideToJpeg` itself is
unopinionated — it renders whatever `RenderSlideInput` it's given — so the preview API
route can legitimately request a safe-zone-on render if a future screen needs one.

## Bespoke renderers

A template's `rendererKey` selects an entry from `src/lib/renderer/renderers/index.ts`.
`"generic-v1"` (the only one that ships today) draws background → overlay → text purely
from `TemplateField` configuration. Unknown/missing keys fall back to it, so a typo or an
unshipped renderer never breaks a render.

To add a bespoke one (section 35 of the handoff doc — `event-coral-editorial-v1`,
`conference-special-v1`, etc.):

1. Create `src/lib/renderer/renderers/<name>.tsx` exporting a function matching
   `SlideRenderer = (input: RenderSlideInput, layouts: SlideLayoutMap) => ReactNode`.
   You still get `layouts` precomputed — never measure text yourself in a bespoke
   renderer; call into `computeSlideLayout`/`fitText` the same way `GenericRenderer` and
   `server.ts`'s driver script do if you need custom positioning logic.
2. Register it in `renderers/index.ts`'s `renderers` map under its `rendererKey`.
3. It does **not** need to draw the safe-zone guide — `SlideCanvas` renders that itself,
   on top of whatever the renderer produces, exactly once, regardless of `rendererKey`.
4. Template Studio (outside this directory's scope) is responsible for only exposing the
   parameters that renderer actually understands.

## Vercel / serverless notes

- `src/app/api/render/preview/route.ts` sets `export const runtime = "nodejs"` (headless
  Chromium needs a real Node runtime, not the Edge runtime) and `export const maxDuration
  = 300` (a cold Chromium launch + font downloads can take a few seconds; exports over
  many slides — `exports/jpg.ts`/`mp4.ts` callers — should set the same on their own route
  handlers).
- `next.config.ts` already lists `puppeteer-core`, `@sparticuz/chromium`, `ffmpeg-static`,
  `mammoth`, `unpdf` under `serverExternalPackages` so Next requires them at runtime
  instead of trying to bundle them, and `outputFileTracingIncludes` ships `public/fonts/**`
  alongside every `/api/**` function (needed by `server.ts`'s self-hosted-font inliner,
  which reads those files from disk with `fs`).

### `outputFileTracingIncludes` must list the actual binaries, not just the packages

`serverExternalPackages` tells Next to `require()` these packages at runtime instead of
bundling them — but Next's file tracer (`@vercel/nft`, which decides what actually ships
in the deployed function) only follows *statically analyzable* `require`/`import`/`fs`
calls. Both `@sparticuz/chromium` (its compressed `bin/*.br` Chromium/swiftshader/fonts
blobs) and `ffmpeg-static` (its platform ffmpeg binary) only ever reference their binary
via a **runtime-computed path string** — extracted or spawned, never `require()`d or
`fs.readFileSync`'d directly — so without an explicit `outputFileTracingIncludes` entry,
the deployed function silently ships the JS wrapper with no binary behind it and fails at
first use. `next.config.ts` lists both explicitly (both the plain `node_modules/…` path
and the `.pnpm/…` real path, so it works whether or not something has hoisted/symlinked
around it):

```ts
outputFileTracingIncludes: {
  "/api/**": [
    "./public/fonts/**",
    "./node_modules/@sparticuz/chromium/bin/**",
    "./node_modules/ffmpeg-static/ffmpeg",
    "./node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/bin/**",
    "./node_modules/.pnpm/ffmpeg-static@*/node_modules/ffmpeg-static/ffmpeg",
  ],
},
```

If a future dependency bump changes either package's own binary-resolution strategy
(check their READMEs), re-verify this the same way the numbers below were produced.

### Bundle size (measured)

Run `pnpm build` (with `CP_MOCK_DATA=1` if Supabase isn't reachable from wherever you're
building), then read `.next/server/app/api/<route>/route.js.nft.json` — the Node File
Trace manifest, i.e. the authoritative list of every file Vercel actually zips into that
function. Sum `fs.statSync` of each listed path **after resolving `fs.realpath`**
(`outputFileTracingIncludes` globs can list the same physical file under more than one
relative path — e.g. once via a pnpm symlink, once via its real `.pnpm/…` location — and
naively summing listed paths double-counts it).

Measured for `/api/render/preview` (Next 16.3.4, Turbopack, this repo's lockfile):

| What | Size |
|---|---|
| `@sparticuz/chromium/bin/chromium.br` | 61.8 MB |
| `@sparticuz/chromium/bin/swiftshader.tar.br` | 3.4 MB |
| `@sparticuz/chromium/bin/al2023.tar.br` | 1.0 MB |
| `@sparticuz/chromium/bin/fonts.tar.br` | 0.2 MB |
| Everything else (Next runtime, puppeteer-core, React, self-hosted font files, route code) | ~5.4 MB |
| **Total (deduplicated)** | **≈ 71.8 MB** |

Comfortably under Vercel's 250 MB per-function limit — even adding `ffmpeg-static`'s own
binary (not measurable here; its postinstall download didn't complete in this sandbox,
see the caveats below, but full static ffmpeg builds for Linux x64 are typically in the
25–80 MB range) to a route that also needs MP4 muxing would still land well inside it.
`api/render/preview` doesn't import `exports/mp4.ts` at all, so it never pays for ffmpeg
in the first place — keep that separation (Chromium-only routes vs. routes that also mux
video) as more bespoke renderers or export formats are added, rather than merging
everything into one function. If a future addition ever does push a function over the
limit, moving MP4 muxing to the browser (a WASM ffmpeg build, client-side) while keeping
server functions Chromium-only is the documented fallback — not needed today.

## Caveats worth knowing about

- **Arimo is shipped here as discrete 400/700 static files**, not a single variable-font
  file (`public/fonts/arimo.css` is a standard Google Fonts css2 static export). Any
  field requesting a weight in between snaps to the nearer of the two
  (`nearestSelfHostedWeight` in both `server.ts` and `fonts/resolve.ts`: ≥600 → 700, else
  400). If a template ever needs true variable-weight rendering, that means adding the
  actual variable woff2 and reworking these two functions — not a template-level fix.
- **`ffmpeg-static`'s postinstall binary download can fail in network-restricted
  environments** (it did in this repo's own sandbox — the postinstall never completed).
  `exports/mp4.ts`'s `resolveFfmpegPath` falls back to an `FFMPEG_PATH` env var or an
  `ffmpeg-` prefixed directory under `/opt/pw-browsers` containing an `ffmpeg-linux`
  binary before giving up with a clear `Mp4EncodeError`. Note that a fallback binary
  found this way might not itself support H.264/MP4 (this sandbox's own
  `/opt/pw-browsers/ffmpeg-*` binary is a Playwright-internal build with only webm/vp8
  enabled) — `tests/unit/renderer/mp4.test.ts` probes for `libx264` + the `mp4` muxer
  before attempting an encode and skips (with a console warning) rather than failing when
  neither is available, and `scripts/render-smoke.ts` does the same for its MP4 step.
  **In a real deployment, make sure `pnpm install` actually reaches ffmpeg-static's
  binary host** — if it can't, MP4 export will fail outright until `FFMPEG_PATH` points
  at a real ffmpeg build.
- **Google Fonts caching existence check downloads the cached file to prove it exists**
  (`fonts/resolve.ts`'s `resolveGoogleFont` calls `store.getObject` and discards the
  bytes just to know whether to skip the fetch-from-Google step). `ObjectStore` has no
  cheap `headObject`/exists check today; adding one would make this an actual HEAD
  request instead. Left as-is for now — correct, just not maximally efficient.
- **The local object store's "signed" URLs are `file://` URIs** (`r2/localStore.ts`) —
  fine for local Node consumers (scripts, tests) that read the path directly, but not
  something to hand to a browser. If mock mode ever needs a real browser-facing URL for
  an R2-backed asset/font, that needs a small dev-only serving route first.
- **Running headless Chromium as root** (common in containerized dev/CI, this sandbox
  included) requires `--no-sandbox`; `server.ts`'s local-executable launch path adds it
  automatically when `process.getuid() === 0`, and never in the serverless
  (`@sparticuz/chromium`) branch, which already ships its own sandboxed args.
- **Running a script that imports `server.ts` directly through plain `tsx`/`node`** hits
  the `server-only` package's real behaviour: it throws unconditionally unless resolved
  through the Next-internal "react-server" webpack alias, which only exists inside Next's
  own build — there is no equivalent when running a bare Node script. `scripts/
  render-smoke.ts` works around this with `scripts/tsconfig.json` (a `paths` override
  redirecting the bare specifier `"server-only"` to a local no-op stub, used **only** when
  running that script via `tsx --tsconfig scripts/tsconfig.json`, never by the actual Next
  build) — see `scripts/stubs/server-only-stub.ts`. Vitest, notably, does **not** need
  this workaround — its own SSR module resolution tolerates `server-only` fine, so
  `tests/unit/renderer/*.test.ts` import `server.ts` directly with no special config.

## Running the smoke test

```
pnpm tsx --tsconfig scripts/tsconfig.json scripts/render-smoke.ts
```

Renders the demo "VEILLÉE DES HOMMES" slide on a coral background, writes
`tmp/smoke.jpg` and (when a capable ffmpeg is available) a 2-frame `tmp/smoke.mp4`,
and verifies the JPEG is really 1920×1080 by reading its SOF0 header directly. `tmp/`
is gitignored — nothing this script writes should be committed.
