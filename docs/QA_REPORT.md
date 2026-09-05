# Church Panels — QA report

**Scope:** full design + functional + bilingual + accessibility + security QA of the MVP
against `docs/BUILD_HANDOFF.md` (sections 45–48 are the acceptance criteria) and the
CURRENT Figma frames in file `iifmcG4VI8WQ2qbgUlVnpc`.
**Mode:** `CP_MOCK_DATA=1`, 1440×1024, EN + fr-CA.

---

## 1. Summary verdict

**Ship-ready with three items that need a product-owner decision** (section 6 below).

* 63 defects/deviations found, **60 fixed** in app code, 3 left for the owner (section 6).
* The largest single find was a **date-formatting bug that made the whole product show the
  wrong day** — the demo Sunday (2026-09-06) rendered as "Saturday, September 5" in the
  page title, week switcher, flow subtitle and admin lists, in both locales.
* Two functional showstoppers in mock mode: **run-sheet upload always failed** (the parser
  reached out to OpenAI even with `CP_MOCK_DATA=1`), and the **French export-blocked
  message was an unparseable ICU string** that rendered as a raw key.
* Every Sunday screen was **128 px too narrow** (a `max-width` that double-counted the page
  padding), which cascaded into wrong card widths and truncated slide titles on the flow.
* Accessibility: 4 axe-core violations at WCAG 2.1 AA (contrast, nested interactives,
  unlabelled listbox, unlabelled file input) — all fixed; the suite is now clean on all
  14 screens in both locales.
* Bilingual: `document.documentElement.lang` is correct on every route, all 114 canonical
  fr-CA strings from brief §4 match verbatim, and a DOM sweep of every FR route finds no
  English leftovers.

Baselines at hand-off (all re-run against a clean mock store as the last action):
`pnpm check` green — typecheck + lint + 253 unit tests (249 passed, 4 pre-existing skips)
+ i18n parity on 537 keys; `pnpm exec playwright test tests/e2e` green — **73/73 passing in
3.6 min**: the 22 original specs, updated where the accessibility refactor changed the
markup, plus 51 new QA specs under `tests/e2e/qa/`; `CP_MOCK_DATA=1 pnpm build` succeeds
with no secret in the client bundle.

---

## 2. What I changed, by area

| Area | Files |
|---|---|
| Date correctness | `src/lib/utils/serviceDate.ts` (new), 6 call sites |
| Sunday layout/geometry | `SundayShell`, `SundayPageHeader`, `PinForm`, dashboard `page.tsx`, `FlowClient`, `EditorClient`, `UploadClient` |
| Components | `SegmentedControl`, `DurationStepper`, `SlideFlowCard`, `SlideFlowList`, `ExportPopover`, `Dropzone`, `SundayWeekSwitcher`, `slideSample` |
| Admin | admin `page.tsx`, `SundaysClient`, `MappingsClient`, `TemplatesClient`, `StudioClient`, `AdminUserAccount`, sign-in page + form, `assets/actions.ts` |
| i18n | `messages/en.json`, `messages/fr-CA.json`, `src/i18n/request.ts`, `src/app/[locale]/layout.tsx` |
| Tokens | `src/app/globals.css` |
| Pipeline | `src/lib/sunday/intake.ts`, `src/lib/openai/client.ts` |
| API gating | `src/app/api/render/preview/route.ts` |
| Misc | `src/app/icon.svg` (new favicon), `src/components/shell/AdminNav.tsx`, `src/components/ui/Dialog`-adjacent a11y |
| Tests | `tests/e2e/qa/*` (new, 7 specs), `tests/e2e/sunday/*`, `tests/e2e/admin/settings.spec.ts`, `playwright.config.ts`, `scripts/qa-export-audit.ts` (new) |

---

## 3. Design QA — deviations against CURRENT Figma

Severity: **S1** breaks the product · **S2** clearly visible against Figma · **S3** polish.

### 3.1 Global / shell

| # | Sev | Screen | Found | Fixed | File |
|---|---|---|---|---|---|
| D1 | S1 | every Sunday screen | Content column 1184 px wide instead of 1312 — `max-w-[1312px]` had the 64 px page padding *inside* it, so every card, metric and panel was undersized and flow slide titles truncated | Yes — cap raised to `max-w-[1440px]` (the Figma canvas), padding stays outside | `src/components/shell/SundayShell.tsx` |
| D2 | S2 | every Sunday screen | Page-header block had no height, so content sat ~15 px high vs Figma | Yes — per-screen min-heights (Dashboard 59, Flow 72, Add/Upload 64, Editor 56) | `src/components/shell/SundayPageHeader.tsx` |
| D3 | S3 | all | No favicon — every first page load 404'd on `/favicon.ico` | Yes — added the brand mark as `src/app/icon.svg` | `src/app/icon.svg` |

### 3.2 PIN access (`4:34`)

| # | Sev | Found | Fixed | File |
|---|---|---|---|---|
| D4 | S2 | Card content centred; Figma is **left-aligned** | Yes | `PinForm.tsx` |
| D5 | S2 | "Open Sunday" rendered **390 px full-width**; Figma hugs its label (brief §25 "buttons hug their content") | Yes — dropped `w-full justify-center` | `PinForm.tsx` |
| D6 | S3 | Title 32 px / description 14 px; Figma 28 / 15 | Yes | `PinForm.tsx` |
| D7 | S3 | Focused PIN box removed the global focus ring (`focus-visible:outline-none`) leaving only a 1 px border | Yes — ring kept alongside the border change | `PinForm.tsx` |

### 3.3 Sunday Dashboard (`5:14`)

| # | Sev | Found | Fixed | File |
|---|---|---|---|---|
| D8 | **S1** | Title read **"Saturday, September 5"** for the 2026-09-06 Sunday. `new Date("2026-09-06T00:00:00")` is parsed in the *server's* timezone and then formatted in `America/Toronto`, shifting the calendar day back. Affected the dashboard title + metadata, week switcher, flow subtitle, admin dashboard, admin Sundays table and Sunday detail | Yes — new `serviceDateToDate()` anchors date-only values at 12:00 UTC; all 8 call sites migrated | `src/lib/utils/serviceDate.ts` + 6 files |
| D9 | S2 | Flow panel action was "Open flow"; Figma shows **"Add slide"** | Yes — button changed; flow-panel rows became links into `/flow?slide=…` so the flow screen stays reachable | `(sunday)/sunday/[date]/page.tsx` |
| D10 | S2 | Run-sheet "Added to flow" badge stretched the full panel width (a `StatusBadge` inside a stretch flex column) | Yes — column is `items-start` | same |
| D11 | S3 | Panel gap 14 px (Figma 18), panel padding 20 (Figma 22), metric cards had no height (Figma 108) | Yes — `StatCard` keeps its intrinsic height; the per-screen Figma height (108 Sunday / 120 Admin) is set at the call site | same |
| D12 | S3 | Dashboard row number reserved a 24 px box and used a 12 px gap; Figma uses 14 px padding, 10 px gaps | Yes | same |

### 3.4 Sunday Flow (`6:5`)

| # | Sev | Found | Fixed | File |
|---|---|---|---|---|
| D13 | **S1** | Hydration mismatch on every flow load — dnd-kit derives `aria-describedby` ids from a global counter that drifts between server and client | Yes — explicit `<DndContext id="sunday-flow">` | `SlideFlowList.tsx` |
| D14 | S2 | Each slide card ended with a `…` (`more-horizontal`) icon button, so the **status pill was not far right** (explicit design-QA checklist item) and the icon implied a menu it did not have | Yes — row now matches Figma `6:19` exactly (grip · thumbnail · text · badge). Slide removal moved beside "Edit slide" in the preview panel — see §6.1 | `SlideFlowCard.tsx`, `SlideFlowList.tsx`, `FlowClient.tsx` |
| D15 | S2 | Preview panel title used 24 px; Figma 18 px | Yes | `FlowClient.tsx` |
| D16 | S2 | Flow subtitle date read "Sep 5, 2026"; Figma "September 6" | Yes — new `monthDay` next-intl format | `src/i18n/request.ts`, both catalogs |
| D17 | S3 | Card padding 20 px (Figma 12), radius `rounded-lg` (Figma 12), selection swapped 1 px→2 px border which nudged content by 1 px | Yes — 12 px padding, inset shadow for the selected edge | `SlideFlowCard.tsx` |
| D18 | S3 | Panels were content-height; Figma panels are 820 px tall with 18 px padding and an 18 px gap | Yes | `FlowClient.tsx` |

### 3.5 Export popover (`52:691`)

| # | Sev | Found | Fixed | File |
|---|---|---|---|---|
| D19 | S2 | Format segmented control: selected segment was white-on-subtle. Figma shows **selected = primary indigo**, unselected = white + border | Yes — new `solid` variant on `SegmentedControl` | `SegmentedControl.tsx`, `ExportPopover.tsx` |
| D20 | S2 | Selected scope row used a slate fill + primary border; Figma uses a primary tint (`#f2f0ff`) and no border, 12 px text that only bolds when selected | Yes — added a `--bg-primary-subtle` token | `globals.css`, `ExportPopover.tsx` |
| D21 | S3 | Title 24 px (Figma 18); "Format"/"Slides" labels 12 px bold (Figma 11 px regular); format control h32/r12 (Figma h38/r8) | Yes | `ExportPopover.tsx`, `SegmentedControl.tsx` |
| D22 | S3 | Selected thumbnail used a 2 px border + a subtle tint over the render; Figma uses a 3 px primary border and no tint | Yes | `ExportPopover.tsx` |

### 3.6 Slide Editor (`6:160`)

| # | Sev | Found | Fixed | File |
|---|---|---|---|---|
| D23 | S2 | Neither panel was a Card — both floated on the canvas with no surface, border or radius | Yes — both are `Card`s, 850 px tall, 20 px padding, 20 px column gap (Figma `6:173`/`6:212`) | `EditorClient.tsx` |
| D24 | S2 | Preview filled the panel; Figma has a 590 px subtle "stage" with the 800×450 render centred inside | Yes | `EditorClient.tsx` |
| D25 | **S1** | The safe-zone overlay rendered **without its "LIVE CAMERA SAFE ZONE" label** in the editor — `safeZoneLabel` was never passed (the flow screen passed it) | Yes | `EditorClient.tsx` |
| D26 | S2 | The Background segmented control **hid the "Image" segment entirely** when a template allowed no assets; Figma `35:570` always shows both | Yes — `SegmentedControl` options accept `disabled`; Image is rendered inert | `SegmentedControl.tsx`, `EditorClient.tsx` |
| D27 | S2 | "Approved color" had no visible label (aria-label only); Figma `62:135` shows a 12 px label above the Color Select | Yes | `EditorClient.tsx` |
| D28 | S3 | Group gaps 20 px; Figma 14 px | Yes | `EditorClient.tsx` |
| D29 | S3 | Demo data: `event-coral-editorial` had `allowTeamBackgroundChoice: false`, so the flagship editor frame could not be reproduced (Figma shows it with Background + "Approved color: Coral") | Yes — flipped in the mock seed | `src/lib/data/mockSeed.ts` |

### 3.7 Add Slide (`7:99`) & Upload Run Sheet (`7:175`)

| # | Sev | Found | Fixed | File |
|---|---|---|---|---|
| D30 | S2 | Template thumbnails rendered placeholder body copy ("Mercredi / 19h00 à 20h00" on Add Slide, the English field labels "Line 1 / Line 2" on the Template Library — an English leak into the FR UI). Figma thumbnails show the template name alone | Yes | `slideSample.ts`, `TemplatesClient.tsx` |
| D31 | S2 | Upload: current-file row had no `file-text` icon (Figma `7:197`) and used a 12 px pad; grid was fractional instead of 620 / 18 / 674 | Yes | `UploadClient.tsx` |
| D32 | S2 | Upload: the "Ready to apply" badge stretched full width | Yes | `UploadClient.tsx` |
| D33 | S3 | Upload: idle info card repeated the panel title ("Run sheet preview" twice) | Yes — new `emptyPreviewTitle` key | `UploadClient.tsx`, both catalogs |

### 3.8 Admin

| # | Sev | Screen | Found | Fixed | File |
|---|---|---|---|---|---|
| D34 | S2 | Sign in (`7:301`) | Hero content vertically centred; Figma is top-aligned with 72 px padding. Logo mark was a translucent circle; Figma is a **solid white 42 px rounded square**. Tagline 40 px; Figma 28 px | Yes | `admin/sign-in/page.tsx` |
| D35 | S2 | Sign in | Both buttons were forced to `width: 100%` with an inline style; Figma hugs (79 px / 178 px) | Yes | `SignInForm.tsx` |
| D36 | S3 | Sign in | "or" had rules either side; Figma is bare centred text. Language Selector centred; Figma left-aligned | Yes | `SignInForm.tsx` |
| D37 | S2 | Dashboard (`7:326`) | "Upcoming Sunday" rows were divider-ruled with a secondary label; Figma uses subtle-filled rows with a bold label | Yes | `admin/(protected)/page.tsx` |
| D38 | S2 | Dashboard | System-health values were badge pills; Figma renders bold coloured text | Yes | same |
| D39 | S3 | Dashboard | "Open Sunday flow" was Secondary; Figma primary. Next-service value used `Sep 6, 2026`; Figma "Sunday Sep 6". Stat cards had no height (Figma 120) | Yes | same |
| D40 | S3 | Dashboard | "Today" was computed in UTC, not the church timezone | Yes | same |
| D41 | S2 | Sundays (`8:36`) | The Slides column rendered a **second "Needs review" badge**, duplicating the Status column | Yes — column is the bare count, as in Figma | `SundaysClient.tsx` |
| D42 | S2 | Sundays | Rows were divider-ruled; Figma uses subtle-filled pill rows with 8 px gaps. Footer was a plain row; Figma is an info-toned band | Yes | `SundaysClient.tsx` |
| D43 | S2 | Templates (`8:317`) | Cards showed the status **twice** (in the "Category · Status" meta line *and* a badge). Figma: name / category / coloured status text | Yes | `TemplatesClient.tsx` |
| D44 | S2 | Mappings (`10:173`) | Explainer was a plain white card; Figma is an info-toned band with a bold blue lead line. Rows divider-ruled; Figma subtle pills. Template column was regular weight; Figma bold | Yes | `MappingsClient.tsx` |
| D45 | S2 | Template Studio (`9:85`) | **Invalid HTML**: the field rows nested a delete `<button>` inside the row `<button>`, which React reported as a hydration error on every studio load | Yes — row is a container with two sibling buttons | `StudioClient.tsx` |
| D46 | S2 | Nav footer | Locale rendered lowercase ("Owner · en"); Figma "Admin · EN" | Yes | `AdminUserAccount.tsx` |
| D47 | S2 | Studio + Sunday detail | **Unicode arrow stand-ins** (`←`) instead of Lucide `arrow-left` — an explicit design-QA checklist violation | Yes | `StudioClient.tsx`, `sundays/[id]/page.tsx` |
| D48 | **S2** | Admin nav (FR) | **Text clipping in French** — "Dimanches et déroulements" was truncated to "Dimanches et déroulem…" in the 260 px sidebar. The checklist requires "no text clipping in EN or FR" | Yes — nav items are `min-h` and wrap instead of truncating | `AdminNav.tsx` |
| D49 | S2 | Assets (`9:413`) | Cards showed the status **twice** ("Backgrounds · Published" plus a badge) and were missing Figma's third line, "Focal point saved". Thumbnails were inset; Figma's are flush to the card | Yes | `AssetsClient.tsx` |
| D50 | S3 | Templates (`8:317`) | Thumbnails were inset with padding on all sides; Figma's render is flush to the card with the text block below | Yes | `TemplatesClient.tsx` |
| D51 | S2 | Brand & fonts (`11:198`) | Font rows were bordered boxes; Figma uses 92 px subtle-filled rows | Yes | `BrandClient.tsx` |
| D52 | S3 | Assets / Sundays dialogs | The Dropzone's action read "Upload", colliding with the dialog's own "Upload" confirm button; Figma's dropzone says "Choose file" | Yes — new shared `common.chooseFile` key | `AssetsClient.tsx`, both catalogs |

---

## 4. Bilingual audit

Method: Playwright walk of all 14 routes in `/fr/…` (plus the slide editor), harvesting
every visible text node and every `aria-label` / `title` / `placeholder` / `alt`, then
filtering for English stopwords absent French orthography. Plus a programmatic diff of
brief §4's 114 canonical EN↔FR pairs against both catalogs, and an ICU format check that
renders every one of the 536 messages in both locales.

| # | Sev | Found | Fixed |
|---|---|---|---|
| B1 | **S1** | `sunday.export.blockedByTextFit` (fr-CA) contained `Le texte d'#…`. In ICU, `'` before `#` starts a quoted section, so the message failed to parse and next-intl rendered the **raw key** to the user whenever a French export was blocked | Yes — rephrased ("Une diapositive contient du texte qui ne s’ajuste pas.") |
| B2 | S2 | dnd-kit's built-in screen-reader instructions and drag announcements are English and were read verbatim in the FR flow ("To pick up a draggable item, press the space bar…") | Yes — 5 new keys wired through `DndContext accessibility` |
| B3 | S2 | Document titles dropped the brand: the FR flow was titled "Déroulement du dimanche", never "… · Eglise Panels" (brief §2 requires the brand everywhere) | Yes — title template on the locale layout |
| B4 | S2 | The slide editor's document title was "Contenu" (the panel heading) | Yes — new `sunday.editor.pageTitle` |
| B5 | S3 | Apostrophes were mixed: 54 straight `'` in fr-CA and 20 in en, against typographic `’` in the brief. Straight apostrophes are also an ICU escape character | Yes — normalised word-internal apostrophes in both catalogs |
| B6 | S2 | English field labels leaked into FR template thumbnails (see D30) | Yes |

Verified good:

* `document.documentElement.lang` is `en` / `fr-CA` on all 14 routes.
* FR dates: page title `dimanche 6 septembre`, flow subtitle `6 septembre`, week switcher
  `dimanche 6 sept.`.
* Brand is `Eglise Panels` in the app header, admin nav, sign-in hero and metadata title.
* All 114 canonical fr-CA strings match the brief verbatim (apostrophe style aside).
* All 536 messages in both locales format without an ICU error, plurals included.
* No English leftovers remain in any FR route after the fixes.

---

## 5. Functional, accessibility, code-quality and security

### 5.1 Functional (brief §46/§48)

| # | Sev | Found | Fixed | File |
|---|---|---|---|---|
| F1 | **S1** | **Manual run-sheet upload always failed in mock mode.** `selectParser()` chose the OpenAI parser whenever `OPENAI_API_KEY` was set, ignoring `CP_MOCK_DATA=1` — so with a key in `.env.local` (and no egress) every upload came back "Processing failed". `docs/INTAKE.md` documents the opposite intent | Yes — mock mode always uses the offline heuristic parser; the doc snippet was corrected too | `src/lib/sunday/intake.ts`, `docs/INTAKE.md` |
| F2 | S2 | **Duration stepper dropped taps.** Two clicks landing before React re-rendered both read the same stale `value` prop and emitted the same number; and a slow server action could resolve after a newer one and overwrite it | Yes — the stepper compounds from the last value it emitted (re-syncing on any new `value` prop) and the card ignores stale responses | `DurationStepper.tsx`, `HoldSecondsCard.tsx` |
| F3 | S2 | The e2e suite ran 2 workers against one shared in-memory store, so the Settings spec's PIN rotation raced the Sunday specs; the restore step also asserted against a still-visible earlier toast, so a failed restore went unnoticed and cascaded into PIN rate-limiting | Yes — `workers: 1` and a restore that round-trips a real Sunday sign-in | `playwright.config.ts`, `tests/e2e/admin/settings.spec.ts` |
| F4 | S2 | **Template Studio's Publish / Move to draft / Archive / Restore only staged local state.** The lifecycle change was silently lost unless the admin then also pressed "Save changes" — so a template could look Published in the header and still be invisible to the Sunday team | Yes — each lifecycle button now persists immediately | `StudioClient.tsx` |
| F5 | S3 | The asset-upload dialog's dropzone action read "Upload", the same accessible name as the dialog's own confirm button (and, after the a11y fix, the hidden file input) | Yes — shared `common.chooseFile` label, matching the Figma dropzone | `AssetsClient.tsx`, both catalogs |

Verified working (each is now a spec in `tests/e2e/qa/`):

* PIN: valid → dashboard with an **httpOnly, SameSite=Lax** session cookie; wrong PIN →
  translated error; 5 failures in 10 min → rate limited, and the *correct* PIN is refused
  while the limiter is engaged.
* Rotating the PIN in Settings invalidates both the old PIN **and an existing session
  cookie** (pinVersion bump), verified from a second live tab.
* Week switcher navigates prev/next Sunday; duration stepper clamps at 1 and 30, disables
  at the bounds, and persists across reloads.
* Drag reorder (pointer) and keyboard reorder (space/arrows/space) both persist, renumber
  the deck, and survive a reload; JPG filenames follow the renumbering.
* Editor: required-field validation; overflow → error Message State → slide `invalid` →
  export disabled with "…text that doesn’t fit" → shorten → Ready → export re-enabled.
* Template switch preserves compatible field values in both directions.
* Background: approved-colour listbox (no hex input anywhere), image mode offers only
  published assets allowed for the template, and there is **no file input on the Sunday side**.
* Include-in-MP4 toggle is reflected in the flow card meta and honoured by MP4 export.
* Add Slide: all 8 category chips, only Published templates, creation lands in the editor.
* Remove slide: works for a manual slide, refused for a structural `always` slide with the
  translated explanation.
* Scenario D end-to-end with the real `260906.docx`: upload → preview (8 found · 6 mapped ·
  4 need review) → **Merge preserves a manual edit**; **Replace regenerates** and drops it.
* Export range parser: `0`, `9-2`, `1,,2`, `1-99`, `a`, `1--2` all rejected with the right
  message and a disabled button; `1-7`, `1,3,5`, `1-4,6-7` and the en-dash form `1–4, 6–7`
  accepted. Field ↔ thumbnail sync verified in both directions.
* Exports (`scripts/qa-export-audit.ts`, all 20 checks pass): single JPG
  `01-bienvenue.jpg`, ZIP of 8 accent-normalised numbered files, MP4 1920×1080 H.264 whose
  duration is exactly `8 included × 5 s = 40 s` per both the `mvhd` box and `ffmpeg -i`.
* **Safe zone never exported**: rendering the same slide with `showSafeZone: true` puts
  indigo `rgb(71,69,238)` pixels in the lower-left region; with `false` there are none
  (sampled through a real Chromium canvas), and `runExport` hardcodes `showSafeZone: false`.
* `/api/health` → 200 + `mockMode: true`; `/api/export` with no session → 401
  `{"error":"unauthorized"}`; `/api/inbound/resend` accepts an unsigned dev payload and
  **dedupes by `email_id`** (a repeat returns the same `runSheetId`).
* Unauthenticated redirects verified for 4 Sunday routes and 7 admin routes.
* Admin: create Sunday (duplicate date → "That Sunday already exists."), template
  create → publish → visible in Add Slide → archive → gone from Add Slide while the
  existing deck still renders; asset upload → publish → allowed for a template →
  selectable in the Sunday editor; mapping create with EN+FR aliases → listed Active;
  locale switch persists across reload; sign-out.

Test-suite changes these fixes forced (adaptation, not weakening):

* The flow list is no longer a `listbox`/`option` (A2), so specs address cards through a
  `[data-slide-card]` attribute and the select control through `[data-slide-select]`.
* Drag-handle locators need `exact: true` — "Drag to reorder slide 1" also matches slides
  10-12 once a deck grows past nine slides.
* Scenario D (Replace) runs against the 2026-08-16 Sunday, the export-download and reorder
  specs against 2026-08-30, and the text-overflow spec against 2026-08-23 — saving a slide
  clears its "needs review" flag, and `tests/e2e/sunday/02-flow` asserts the demo Sunday
  still has one. Only the demo Sunday's *read-only* assertions run against 2026-09-06.
* `tests/e2e/qa/06-admin` derives a fresh 2027 Sunday date per run instead of a fixed one:
  the mock store survives repeated runs against a single dev server, so a hardcoded date is
  creatable only once.
* `tests/e2e/sunday/01-pin-and-locale` scopes its brand assertion to the header — now that
  document titles are "<page> · Church Panels" (B3), Next's route announcer carries the
  brand too and a bare `getByText` is ambiguous.
* `playwright.config.ts` pins `workers: 1` (F3).

### 5.2 Accessibility (brief §40)

Ran `@axe-core/playwright` (WCAG 2.0/2.1 A + AA) over all 14 screens plus the export
popover and a modal dialog, in addition to manual keyboard traversal.

| # | Sev | Found | Fixed | File |
|---|---|---|---|---|
| A1 | S2 | **Contrast**: `--status-success-text` #16a34a on its own badge fill is 3.15:1 and `--status-warning-text` #d97706 is 3.07:1 — both fail AA for normal text; `--status-error-text` #dc2626 was 4.41:1, marginally under. The "Ready" badge appears on every slide | Yes — one step darker in the same hue family: #15803d (4.79), #b45309 (4.84), #b91c1c (5.91). See §6.3 | `globals.css` |
| A2 | S2 | **nested-interactive**: each flow card was a `role="option"` containing a focusable drag-handle button, which is invalid and breaks AT navigation | Yes — the list is a plain `<ul>`/`<li>`; a single button selects the card and carries `aria-pressed` | `SlideFlowCard.tsx`, `SlideFlowList.tsx` |
| A3 | S2 | **aria-input-field-name**: the flow `role="listbox"` had no accessible name | Yes — labelled (and now a semantic list) | `SlideFlowList.tsx` |
| A4 | S2 | **label (critical)**: the Dropzone's hidden `<input type="file">` had no accessible name | Yes — `aria-label` | `Dropzone.tsx` |

Verified good: focus-visible rings are token-driven and present on every control (checked
computed `outline` on the drag handle); segmented controls are real `radiogroup`/`radio`
with roving focus and arrow keys; chips carry `aria-pressed`; the safe-zone action is a
toggle with `aria-pressed` and a label that flips; the Toggle is `role="switch"` with an
accessible label; dialogs use native `showModal()` so focus never reaches a control behind
them and Escape closes; the PIN screen is fully operable from the keyboard (type, auto-
advance, Enter submits); slide status is always written out, never colour alone.

### 5.3 Code quality

* No hardcoded user-facing strings in `src/app/**` or `src/components/**` (the only literal
  matches are in unit tests and the `/kit` dev gallery).
* No raw hex outside `mockSeed`, the renderer, and data-driven defaults (template
  background/text colour, approved-colour swatches, mock asset gradients).
* Unicode arrows removed (D47); no emoji, no non-Lucide icons.
* No arbitrary fixed widths on buttons — the remaining `w-[…]` values are Figma component
  variant sizes (Language Selector 88/104, Week Switcher 220/260, Admin Nav 260, Export
  popover 380, thumbnails 76/88).

### 5.4 Security

* `SUPABASE_SERVICE_ROLE_KEY`, R2, Resend and OpenAI keys are only read in `src/lib/**`
  server modules. `src/lib/openai/client.ts` was the one secret-touching module without
  `import "server-only"` — **added**, so an accidental client import is now a build error
  (Vitest and `scripts/tsconfig.json` already alias it to a no-op stub).
* Client-bundle scan of `.next/static` after `CP_MOCK_DATA=1 pnpm build`: **no matches**,
  both for the env-var *names* (`SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|RESEND_API_KEY|
  R2_SECRET`) and — the stronger check — for the literal secret *values* read out of
  `.env.local` (14 of them, `CRON_SECRET`, `SUNDAY_SESSION_SECRET`, the Supabase service-role
  and secret keys, all four R2 values, `RESEND_API_KEY` and `OPENAI_API_KEY`). See §7.
* Sunday session cookie: `httpOnly`, `sameSite=lax`, `secure` in production, signed with
  jose, carries `pinVersion` so a PIN rotation invalidates live sessions. Asserted in a spec.
* PIN rate limit: 5 failures / 10 minutes, bucketed by a hashed client IP (the raw IP is
  never stored), and it also refuses the correct PIN while engaged.
* `/api/export` requires a Sunday or admin session (401 otherwise); `/api/inbound/resend`
  verifies the Svix signature when a secret is configured; every `/admin/**` route and every
  gated `/sunday/**` route redirects when unauthenticated.
* **`/api/render/preview` was completely unauthenticated.** It accepts an arbitrary
  `RenderSlideInput` (background image URLs included) and drives headless Chromium with a
  300 s `maxDuration` — an anonymous denial-of-service and server-side-fetch vector, and
  the only render/export route without a session check. Nothing in the app calls it (it is
  a debugging/parity endpoint). **Fixed**: same Sunday-or-admin session gate as
  `/api/render/slide/[slideId]`, with a spec asserting the 401.
* `/api/cron/maintenance` requires `Authorization: Bearer ${CRON_SECRET}` and refuses when
  the secret is unset. Asserted in a spec.
* Upload validation: run sheets are limited to 10 MB and DOCX/PDF by MIME **and** extension,
  server-side. Asset uploads validated MIME against an allowlist and verified real image
  dimensions from the bytes, but had **no server-side size limit** — only the client
  Dropzone enforced 10 MB. **Fixed**: `MAX_ASSET_BYTES` guard in the server action.

---

## 6. Left for the product owner

### 6.1 Where "Remove slide" lives  *(deviation I introduced deliberately)*

Figma `6:19` has no menu on the flow card — grip, thumbnail, text, status pill, full stop —
and the design-QA checklist requires the status pill to be far right. The build had put a
`…` button after the pill. I removed it and moved slide removal to a ghost **"Remove slide"**
button next to "Edit slide" in the preview panel. That restores the row exactly but adds a
control the Figma right panel does not show. Alternatives if you prefer: put it in the slide
editor header next to "Duplicate", or drop Sunday-side removal entirely (brief §5's list of
Sunday capabilities does not include it).
Screenshots: `tmp/qa/sunday-flow-en.png`, `tmp/qa/sunday-flow-fr.png`.

### 6.2 Two header actions where Figma and `design/figma/screens.md` disagree — **not changed**

Both documents derive from the same file, so one of them is a transcription error and I did
not want to guess on a navigational change:

* **Admin dashboard header** — Figma `7:326` shows `Upload run sheet` + **`New template`**;
  `screens.md` says `Upload run sheet` + **`Create Sunday`**. The build has *Create Sunday*.
* **Admin mappings header** — Figma `10:173` shows **`Review suggestions`**; `screens.md`
  says **`Import from run sheet`**. The build has *Import from run sheet*.

(By contrast I *did* change the dashboard's "Open flow" → "Add slide", D9, because the Figma
screenshot is unambiguous and no functionality is lost.)
Screenshots: `tmp/qa/admin-dashboard-en.png`, `tmp/qa/admin-mappings-en.png`.

### 6.3 Status-colour tokens are one step darker than the Figma extract

`design/figma/tokens.json` records green-600 / amber-600 / red-600 for status text. Those
fail WCAG AA on their own badge fills (3.15 / 3.07 / 4.41), and brief §40 requires an
accessible contrast set, so `globals.css` now uses green-700 / amber-700 / red-700
(4.79 / 4.84 / 5.91). The badges are visually near-identical but they are no longer the
literal Figma hexes. Revert the three lines in `globals.css` if you would rather keep the
exact values and accept the contrast failure.

### 6.4 Smaller notes, no action taken

* **"Received by email · 2 pages"** (Figma `5:87`) — the app shows "Received by email"
  without the page count. There is no `page_count` on `run_sheets`; adding it needs a
  migration plus extraction changes, so I left it rather than reach into the schema.
* **Editor / sign-in input widths** — Figma draws `Input` instances at their master's
  default 320 px inside 380 px and 366 px content columns, while the sibling Message State
  and "or" row *are* resized to the container. I read that as an un-resized instance rather
  than intent and made the inputs full-width. One line each to change back.
* **Template Studio field selection** — Figma `9:85` says clicking a field row "loads its
  typography/position controls into the left column"; the build appends a second card
  beneath the template controls instead of swapping the column's contents. Same information,
  one extra scroll.
* **Settings cards** — Figma `11:489` shows 524×340 cards whose content is clipped. The
  app's cards grow to fit their (more numerous, more functional) fields.
* **Admin nav icons** — Figma reuses `file-text` for Mappings and a gear for Brand & Fonts;
  the build uses `link-2` and `type`, which read better and are still Lucide.
* **Template Library filters** — Figma has one chip row mixing status and category; the
  build has two rows so each filter can be reset independently.
* **Mock asset images** — `mockAssetUrl` stands in for real R2 photos with a generated
  gradient that has the asset's English slug painted into it ("Mountain sunrise"), so those
  words appear inside the *image* on the FR asset library and on the Annual theme thumbnail.
  It is image content, not a UI string, and disappears the moment real assets are uploaded.
* **Demo data** — the seeded Sunday's headlines are the church's real French uppercase copy
  ("BIENVENUE"); Figma's mock uses title case ("Welcome"). Slide copy is never translated or
  re-cased by the app (brief §2), so this is a demo-data difference, not a UI defect.
* **Real run sheet produces 6 invalid slides out of 12.** Applying `260906.docx` and
  letting the pipeline generate the deck leaves six slides marked "Text is too long" —
  every one of them because the run sheet's own `line2` copy is long (e.g. "ENVELOPPES ET
  PANIER À L’ARRIÈRE DU SANCTUAIRE · VIREMENTS INTERAC EN LIGNE · …"). Export is correctly
  blocked until they are shortened, which is exactly what brief §12 asks for — but it means
  the team's first action most weeks is trimming half the deck. If that is more friction
  than intended, the lever is the templates' `line2` rules (`maxLines`, `minFontSize`,
  `overflowMode: auto_fit`) in Template Studio, not the engine.
* **Optimistic duration stepper** — tapping and *immediately* reloading can lose the last
  step or two, because the value is shown optimistically while the write is in flight.
  Normal use is unaffected; the QA spec settles before asserting persistence.

---

## 7. Commands run

```bash
# Environment
pkill -f 'next dev'
CP_MOCK_DATA=1 pnpm dev                       # port 3000, mock store

# Baselines and gates
pnpm check                                    # typecheck + lint + vitest + i18n parity
pnpm exec playwright test tests/e2e

# Design pass — 1440x1024 screenshots, EN + FR, into tmp/qa/ (gitignored)
node tmp/shots.mjs                            # 15 screens x 2 locales
node tmp/measure.mjs                          # computed geometry vs Figma metadata

# Figma references (MCP): get_screenshot / get_metadata / get_design_context on
# 4:34 5:14 6:5 52:691 6:160 7:99 7:175 7:301 7:326 8:36 8:317 9:85 9:413 10:173 11:198 11:489

# Bilingual
node tmp/i18n-scan.mjs                        # every /fr route, all text nodes + aria
node tmp/icu2.mjs                             # formats all 536 messages in both locales
pnpm i18n:check

# Functional
pnpm tsx --tsconfig scripts/tsconfig.json tmp/probe-range.ts          # range parser edges
CP_MOCK_DATA=1 pnpm tsx --tsconfig scripts/tsconfig.json scripts/qa-export-audit.ts
pnpm exec playwright test tests/e2e/qa

# Accessibility
pnpm add -D @axe-core/playwright
pnpm exec playwright test tests/e2e/qa/07-accessibility.spec.ts

# Security
CP_MOCK_DATA=1 pnpm build                     # dev server stopped first (shared .next)
grep -rlE 'SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|RESEND_API_KEY|R2_SECRET' .next/static
#   -> no matches; plus a byte scan of .next/static for every literal secret value
#      in .env.local -> no matches
```

Screenshots for every screen in both locales are in `tmp/qa/<screen>-<locale>.png`
(gitignored via the repo's `/tmp/` rule).
