# Run sheet intake + export — how the pipeline is wired

Implementation notes for `src/lib/sunday/{intake,slides,exports,render-input,contracts}.ts`,
`src/app/api/export/**`, `src/app/api/inbound/resend/**`, `src/app/api/render/slide/**`,
and `src/app/api/health/**`. Product behaviour is specified in `docs/BUILD_HANDOFF.md`
sections 8-10, 15-19, 32, 33, 38 — this document is about how the code delivers that.

## The one pipeline

> Manual upload and Resend inbound email call the exact same function:
> `ingestRunSheet()`. There is no second parser, no second mapping/apply path.

```
ingestRunSheet(input)
  ├─ validate type/size (docx/pdf, 10 MB)
  ├─ resolve target Sunday (explicit sundayDate, or next Sunday in settings timezone)
  ├─ dedupe by inboundEventId (email retries never create a second run sheet)
  ├─ store original bytes (R2, or the local filesystem store in mock/no-R2 mode)
  ├─ create the run sheet row (queued → processing)
  ├─ processRunSheet()  — @/lib/run-sheets/pipeline (extract → parse), unchanged
  │    └─ parse: real OpenAI (hasOpenAI()) or the offline heuristic fallback
  └─ store extractedText/parsedJson/modelOutput, status ready_to_apply | needs_review | failed
```

`ingestRunSheet` never throws for an expected failure (bad file, extraction error, parse
error) — it always returns the run sheet record, `failed` with `parseError` set instead.
That's what lets `/api/inbound/resend` always answer Resend with 200 quickly, and what
lets the Sunday Team's upload screen show "Processing failed" instead of a crash.

`previewRunSheet` / `applyRunSheet` / `reprocessRunSheet` all sit on top of the same
`ParsedRunSheet` this pipeline produced — `previewRunSheet` runs `planApply` (from
`@/lib/run-sheets/plan`, already pure/no I/O) in dry-run "merge" mode and never writes;
`applyRunSheet` runs it for real in whichever mode the team picked and pushes the result
through the `Db` (`replaceSlidesForSunday` for replace, `deleteSlide`/`updateSlide`/
`createSlides` + a final `reorderSlides` for merge).

## The offline heuristic parser

`src/lib/sunday/heuristicParse.ts` exists so the product works with **zero external
dependencies** — no OpenAI key configured, `CP_MOCK_DATA=1`, or every unit test. It has
the exact same call signature as `parseRunSheetText` (`@/lib/openai/client`), so
`ingestRunSheet`/`reprocessRunSheet` just pick one function:

```ts
const parse = hasOpenAI() ? parseRunSheetText : heuristicParseRunSheetText;
```

It never sees the document's *meaning* — only its shape:

1. Find numbered section headings (`1.-`, `2.-`, ...) on their own line; content before
   the first heading (roster lines, the service-date line) is never an announcement.
2. Every blank-line-separated block within a section is one announcement.
3. A block's headline is whichever line exactly matches (accent/case-insensitive) a
   known mapping alias/canonical name; otherwise its shortest line. Other lines become
   `line1`/`line2`.
4. `confidence` is `0.6` and `reviewReasons` is `["heuristic_parse"]`, unless step 3
   found an exact mapping match, in which case `confidence` is `0.95` and
   `reviewReasons` is empty.

This is intentionally rougher than the real parser (see `scripts/parse-fixture.ts`'s
side-by-side output on the real fixture) — it exists to keep the app usable, not to
rival GPT. The *real* mapping/template resolution still happens for real in
`src/lib/mappings/matcher.ts` + `src/lib/run-sheets/plan.ts` against the live
`AnnouncementMapping[]` list, so a heuristic-parsed announcement whose headline is
merely *close* to a known alias (fuzzy match) still lands on the right template even
though this parser's own `canonicalKey` guess was `null`.

## Export blocking

`runExport` (`src/lib/sunday/exports.ts`) resolves the requested scope against the
**full** Sunday Flow (never the subset) so JPG filenames are always prefixed by a
slide's true position — `buildExportFilenames` runs once over every slide, and the
subset just picks its filenames out of that. It then renders through the one shared
renderer (`renderSlidesToJpegs`) and inspects each slide's `SlideFitResult`:

- any field's content missing where `required` → `missing_required`
- any field `!fits` (i.e., real overflow) → `text_overflow`

Both mark the offending slides `status: "invalid"` and block the whole export — nothing
partially ships. `checkDeckExportable` is a **separate**, much cheaper check meant for a
"fix before exporting" banner on the Sunday Flow screen: it runs `fitSlide` with a
deterministic char-count measurer (no canvas/DOM, so it works in plain Node) instead of
spinning up headless Chromium. It is advisory only — `runExport`'s own Chromium-based
fit check is the real, authoritative gate at export time.

## Resend inbound

`/api/inbound/resend` always answers `200 { ok, runSheetId? }` quickly — Resend retries
on anything else — except an unverifiable webhook signature, which is a request worth
refusing outright. `RESEND_INBOUND_WEBHOOK_SECRET` unset is only tolerated outside
production (a loud `console.warn`); production with no secret configured is a hard 401.

Attachment bytes are not always inline on the webhook payload — when they aren't, the
route calls the Resend SDK (`resend.emails.receiving.attachments.get({ emailId, id })`)
to get a signed `download_url` and fetches that. An ambiguous pick (two `.docx`, say)
or an unsupported attachment set never blocks the response: it's recorded as a
`system_checks` row (`inbound_ambiguous` / `inbound_unsupported`) for Admin to notice,
and the webhook still answers 200.

The first run sheet of the week (target Sunday has no slides yet) is auto-applied
(`applyRunSheet(id, "replace")`) — "Added to flow" per section 16. If the Sunday
already has a deck, the run sheet is left `ready_to_apply`/`needs_review` for the team
to review from the Upload screen instead of silently overwriting manual work.

## Manual test/verification scripts

None of these are part of `pnpm test` — they need real network/Chromium/ffmpeg access
this repo's own CI sandbox may not have, and they're for a human to read the output of:

- `pnpm tsx --tsconfig scripts/tsconfig.json scripts/parse-fixture.ts` — runs the real
  fixture DOCX through both the heuristic parser and (when `OPENAI_API_KEY` is
  configured, `.env.local` included) the real OpenAI parser, printing both parses and
  the resulting Sunday Flow plan side by side. In a sandboxed dev environment that
  routes outbound HTTPS through an env-configured proxy (`HTTPS_PROXY`), Node's own
  built-in `fetch` (the OpenAI SDK's transport, Node >= 22.21) does not read it unless
  `NODE_USE_ENV_PROXY=1` is exported **before the process starts** — curl and other
  tools that read `HTTPS_PROXY` directly work regardless, which is why only this
  OpenAI-calling script needs the extra flag:
  `NODE_USE_ENV_PROXY=1 pnpm tsx --tsconfig scripts/tsconfig.json scripts/parse-fixture.ts`.
  Even with that, `api.openai.com` may still not be in a given sandbox's egress
  allowlist at all (403) — that's an organization network policy to report, not route
  around (see `/root/.ccr/README.md`'s "403 / 407 from the proxy" section, where one
  exists) — and a configured key can also simply be out of credits (429). Either way
  the heuristic path is exercised regardless and needs no network.
- `pnpm tsx --tsconfig scripts/tsconfig.json scripts/export-smoke.ts` — mock mode:
  builds on the seeded demo Sunday, runs a real JPG (all slides) and MP4 (all slides)
  export, writes both to `tmp/`, and prints sizes/filenames.
- `pnpm tsx --tsconfig scripts/tsconfig.json scripts/r2-setup.ts [retentionDays]` —
  idempotently creates the configured R2 bucket and (re)applies its lifecycle rule.

Scripts must be run with `--tsconfig scripts/tsconfig.json` (which stubs `server-only`
and sets the `@/*` alias for plain `tsx`, outside any Next.js/Vitest build) — see
`scripts/render-smoke.ts` for the established precedent.

## Tests

`tests/unit/sunday/*.test.ts` run in mock mode (`process.env.CP_MOCK_DATA = "1"` before
the first `await import(...)`, matching the pattern already used by
`tests/unit/data/sunday-session.test.ts`) against the real `260906.docx` fixture through
the heuristic parser — no network, deterministic. `tests/integration/export.test.ts`
exercises `runExport` end to end with the real renderer + ffmpeg; it's gated behind
`describe.skipIf(!process.env.RUN_INTEGRATION)` and needs a local Chromium/ffmpeg, so run
it explicitly: `RUN_INTEGRATION=1 pnpm test tests/integration/export.test.ts`.
