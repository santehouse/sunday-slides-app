# CURRENT screens — structural reference (Figma file iifmcG4VI8WQ2qbgUlVnpc)

Canvas is 1440×1024. Sunday screens: App Header at (64,40) w1312 h48; Sunday Page Header at (64,116) w1312; content column
x=64 w=1312. Admin screens: Admin Nav w260 full height on the left; content area x=260 w=1180 with 48px padding (studio uses 36).
Backgrounds: page `--bg-canvas`, cards `--bg-surface` + 1px `--border-default` + radius 14 (12 on rows/cards inside lists).

Build agents: call `mcp__Figma__get_design_context` with the node id for exact code + a screenshot. Never reference page `90 — ARCHIVED`.

## Simplified Sunday IA (Sept 2026)

The Sunday Team side no longer matches the `10 — Sunday Team` frames below — it was rebuilt around a 3-step
stepper (Run sheet → Check slides → Download) for volunteers who don't think in "flow / deck / merge / export"
terms. `/sunday/[date]` is now Step 2 ("Check slides", the default screen) with an inline edit panel and add-slide
picker; `/sunday/[date]/run-sheet` is Step 1 (an inbox across all Sundays, not per-Sunday upload); `/sunday/[date]/
download` is Step 3 (two big download cards + a collapsed "Advanced options" section carrying the old Export
Popover's custom-selection UI). The tab strip, Overview metrics page, and week switcher are gone from the Sunday
side. Old routes (`/flow`, `/upload`, `/add`, `/slide/[slideId]`) still work as redirects into the new IA. Copy
lives under the `sunday.simple.*` i18n namespace — see `src/components/sunday/{SundayStepper,CheckSlidesClient,
RunSheetInbox,DownloadClient,SlideEditPanel,SlideAddPanel}.tsx`. The frames below are historical reference for the
renderer/admin side and for what the Sunday screens looked like before this rebuild — do not implement new Sunday
work against them.

## Sunday Team — page `10 — Sunday Team` (2:108) — ARCHIVED, see note above

### 01 PIN Access · CURRENT — node `4:34`
- App Header only. Centered Access Card 460×340 (radius 14, padding 34): title "Sunday team access" Arimo Bold 28 (2 lines allowed);
  description "Enter the shared 4-digit PIN to open this Sunday's deck." Arimo Regular 15 `--text-secondary` (our PIN is 5 digits → copy says "5-digit", digit count configurable);
  PIN boxes 72×64 gap 12, radius 10, border `--border-default`, focused box border `--border-focus`, digit Arimo Bold 24 centered;
  Primary button "Open Sunday" (h40); link "Admin? Sign in with email instead." Arimo Regular 14 `--text-secondary` underline on hover.
- Behaviors: numeric keyboard, auto-advance, backspace goes back, paste fills all, Enter submits when complete, invalid → Message State Error under boxes, rate-limit message.

### 02 Sunday Dashboard · CURRENT — node `5:14`
- Page Header (Dashboard): "Sunday, September 6" + subtitle "Draft prepared from 26-09-06.docx · Added to Sunday flow"; Week Switcher MD right.
- Metrics row y=203, 4 cards 317×108 gap 14 (radius 12): value Arimo Bold 26 + label Arimo Regular 12 `--text-secondary`:
  Slides prepared / Needs review / Included in MP4 / 4th card holds Duration Stepper LG.
- Below (y=339): left "Sunday Flow Panel" 870×650 (radius 14, padding 22) header row "Sunday flow" Arimo Bold 18 + Secondary button "Open flow" right;
  list of rows h68 gap 10 radius 10 bg `--bg-surface-subtle`? (light) with "01" number, 80×45 thumbnail, title, Status Badge far right.
- Right "Run Sheet Panel" 424×650: "Run sheet" Arimo Bold 18; filename Arimo Bold 14; "Received by email · 2 pages" 12 secondary;
  summary paragraph 13 secondary; Status Badge "Added to flow"; Leading Icon Button Secondary (upload icon) "Replace run sheet".
- Empty state (no Sunday/run sheet): panel shows "Waiting for run sheet" badge + copy + "Upload run sheet" primary.

### 03 Sunday Flow · CURRENT — node `6:5` (+ Export Popover `52:691`)
- Page Header (Flow): "Sunday flow" + subtitle "September 6 · 8 slides · 5 sec global hold · order controls the MP4 loop"; right: Upload run sheet (Secondary), Add slide (Secondary), Export ▾ (Primary).
- Body y=212: left list card 500×820 (padding 18, gap 10) of Slide Flow Cards h88 (see components.md). Selected card = primary border, same bg.
  Row 06 shows "Template match needs confirmation" meta + "Review" badge (warning).
- Right preview card 794×820 (padding 18): header row title "Veillée des hommes" Arimo Bold 18 + Safe Zones Action (Active → "Hide safe zones") right;
  16:9 preview 758×426 radius 12 (actual renderer output, safe-zone overlay drawn when active: dashed box bottom-left "LIVE CAMERA SAFE ZONE" label, translucent primary tint);
  below: Leading Icon Button Primary (pencil) "Edit slide".
- Export Popover anchored under Export trigger, right-aligned, 380×520 (see components.md). Selecting scope shows/hides range + thumbnails.
- Drag & drop reorder (dnd-kit) + keyboard reorder (focus handle, Space, arrows). Persist order on drop.

### 04 Slide Editor · CURRENT — node `6:160`
- Page Header (Editor): ← back, slide title Arimo Bold 24; right: Duplicate (Secondary), Save changes (Primary).
- Left panel 420×850 (padding 20): "Content" Arimo Bold 18; Select "Template"; Inputs "Headline", "Line 1", "Line 2" (only fields the template exposes, in sort order);
  "Background" label 12 bold + segmented control Color | Image (192×36 container radius 10 subtle bg; selected segment surface bg + border, Arimo Bold 12);
  "Approved color" label + Color Select (Color mode) OR asset picker grid (Image mode: published assets allowed for template, 3-col 16:9 tiles, selected = primary border);
  Toggle "Include in MP4"; Message State (Success/Warning/Error per text-fit result).
- Right panel 888×850 (padding 20): "Live preview" Arimo Bold 18 + Safe Zones Action right; preview area 848×590 subtle bg radius 12 with 800×450 rendered slide centered.
- Unsaved changes prompt on back. Save disabled while text does not fit? No — save allowed; export blocked. Show Error state.

### 05 Add Slide · CURRENT — node `7:99`
- Page Header (Add Slide): ← "Add slide"; right Cancel.
- Helper line y=204 Arimo Regular 13 `--text-secondary`: "Choose a published template. Styling is locked; you'll only edit the content fields that template exposes."
- Filter chips y=244: All · General · Events · Special · Giving · Welcome · Theme · Closing.
- Grid y=296: 4 columns, Template Cards 312×260, gap 16; thumbnail = real render of template with placeholder copy; meta "General · Published".
- Click card → creates slide from template (default copy from template field labels) and navigates to Slide Editor.

### 06 Upload Run Sheet · CURRENT — node `7:175`
- Page Header (Upload Run Sheet): ← "Upload run sheet"; right Cancel.
- Left card 620×820 (padding 22): "Manual upload" Arimo Bold 20; helper 13 secondary "Use this if the pastor's email did not arrive or you received a revised file Sunday morning.";
  Upload Dropzone 576×280; current-file row 576×78 (file-text icon, "Current: 26-09-06.docx" bold 14, "Received by email · Added to flow" 12 secondary).
- Right card 674×820: "Run sheet preview" Arimo Bold 20; "Review what was detected before applying it to Sunday." 12 secondary; filename bold 14;
  Status Badge "Ready to apply" (or Processing / Processing failed → Message State Error + "Try again");
  summary "7 announcements found · 6 mapped · 1 needs review" 12; list of Detected announcement rows 630×64 (radius 10, subtle bg): title bold 14, template name 12 secondary, status text right ("Ready" success / "Review" warning);
  "+ 3 more announcements" link 12; actions bottom: "Replace deck" (Secondary, destructive confirm dialog) and "Merge updates" (Primary).
- States: idle (dropzone only, right panel shows empty "Upload a file to preview" info), uploading (progress), processing (spinner + "Processing"), ready_to_apply, failed.

## Admin — page `20 — Admin` (2:109)

### 01 Admin Sign In · CURRENT — node `7:301`
- Split: left 650px panel bg `--bg-primary`? (check screenshot: left panel dark indigo with white text) — logo mark 42, "Church Panels" Arimo Bold 32, tagline Arimo Bold 40 "Design control stays with the brand team. Sunday stays simple.", body 16 "Manage published templates, assets, announcement mappings, fonts, defaults and admin access."
- Right 790px canvas: card 430×520 (padding 32, radius 14): "Admin sign in" Arimo Bold 26; helper 13; Input Email; Input Password; Primary "Sign in"; divider "or"; Secondary "Email me a magic link"; Language Selector MD.
- Errors/success as Message State.

### 02 Admin Dashboard · CURRENT — node `7:326`
- Title "Admin dashboard" Arimo Bold 28 + subtitle 13; right: "Upload run sheet" (Secondary) + "Create Sunday" (Primary).
- 4 stat cards 260×120: "Sunday Sep 6 / Next service", "24 / Published templates", "38 / Published assets", "12 / Announcement mappings".
- Left card 690×650 "Upcoming Sunday": subtitle; rows h58 (label left, value right): Run sheet → badge; Slides → "8 prepared · 1 needs review"; Video loop → "7 included · 35 sec"; Structural defaults → list; button "Open Sunday flow" (Secondary).
- Right card 376×650 "System health": rows h44 label + status text right (Inbound email Connected / OpenAI parser Ready / R2 storage Healthy / Supabase Active / 48h maintenance Scheduled) — statuses from `system_checks` + env presence, colored via badge tokens.

### 03 Sundays & Run Sheets · CURRENT — node `8:36`
- Title "Sundays & run sheets" + subtitle; right: "Upload run sheet" (Secondary), "Create Sunday" (Primary).
- Table card: header row (Sunday · Source · Status · Slides · Updated) Arimo Bold 12 secondary; rows h72 with Status Badge; row click opens `/admin/sundays/[id]` (detail: run sheets list, reprocess, merge/replace, open Sunday flow).
- Footer info row: "Inbound email" + "announcements@<domain> · DOCX/PDF attachments are processed automatically."

### 04 Template Library · CURRENT — node `8:317`
- Title "Template library" + subtitle "Only Published templates are visible to the Sunday team."; right "Create template" (Primary).
- Chips: All · Published · Draft · Archived · General · Events · Special · Giving (status + category filters).
- Grid 4 cols Template Cards 257×270 (thumb 255×143): name, category, status.

### 05 Template Studio · CURRENT — node `9:85`
- Header: name Arimo Bold 22 + Status Badge; right "Preview" (Secondary) + "Publish"/"Save" (Primary).
- Three columns: controls 320 (Input name EN, Select category, Select status, Select background type, Input background value/color; "Typography" Select font, Inputs size/min size/line height…; "Text fitting" Select overflow mode, Input max lines) ·
  canvas 510 ("Canvas · 1920×1080" + eye "PIP guide on" toggle; preview 446×251 rendered live; info box "Implementation model") ·
  fields 250 ("Editable fields" list rows: Headline "Team editable · Max 3 lines", Date "Team editable · Fixed size"…, Background "Admin only", Overlay "Admin only"; Toggle "Include in MP4 by default").
- Field selection: clicking a field row loads its typography/position controls into the left column.

### 06 Asset Library · CURRENT — node `9:413`
- Title "Asset library" + subtitle; right "Upload asset" (Primary). Chips: All · Published · Draft · Archived · Photography · Backgrounds · Special events.
- Grid 4 cols cards 257×270 (image 255×160): name, "Photography · Published", "Focal point saved".
- Asset detail dialog: name EN/FR, category, status, focal point picker (click on image), allowed templates multi-select.

### 07 Announcement Mappings · CURRENT — node `10:173`
- Title "Announcement mappings" + subtitle; right "Import from run sheet" (Secondary) + "New mapping" (Primary).
- Info card (h66): two lines about mapping vs weekly copy.
- Table: Canonical announcement · Aliases · Template · Status(Active badge). Final row "Suggested" badge with text about unmapped item seen this week.

### 08 Brand & Fonts · CURRENT — node `11:198`
- Title "Brand & fonts" + subtitle; right "Save" (Primary).
- Left card "Font library": rows h92 (family bold 14, source 12, weights 12; badge right: Enabled / Needs font file / Available); upload row (upload icon, "Upload custom font", "WOFF / WOFF2 · enter family, weight and style metadata after upload.").
- Right card "Brand defaults": Inputs (Church name, Primary color hex, Secondary color hex) + "Interface languages" chips English · Français (Canada). Approved colors list management lives here too (add/edit name EN/FR + hex, enable, order).

### 09 Settings & Admin Users · CURRENT — node `11:489`
- Title "Settings" + subtitle; right "Save changes" (Primary).
- 2×2 cards 524×340: "Church & Sunday" (Input church name, Select timezone, Select default locale, Input default slide duration);
  "Run sheet intake" (Input inbound email, Input webhook secret masked, Toggle auto-process, Button "Send test email"/"Reprocess last");
  "Broadcast & storage" (Inputs PIP x, y, width, height; retention days);
  "Access & administrators" (Input Sunday PIN, Button "Rotate PIN"; admin list rows name/email + role right; Button "Invite admin").

## Flows & States — page `30` (2:110), node `12:518`
Run sheet states: Waiting for run sheet · Processing · Ready · Needs review · Failed. Safety rules: never silently destroy manual edits (Merge/Replace);
mapping chooses template, run sheet chooses copy; structural defaults inserted even if absent; overflow blocks export; PIP guide never exported;
JPG and MP4 share one render. Template lifecycle Draft/Published/Archived. Language: UI toggle EN/FR-CA; admin pref persists to account; Sunday pref persists to device; parser reads EN+FR; never auto-translate slide copy.
