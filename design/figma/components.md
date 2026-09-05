# Figma component masters — reference extracted from `02 — Components` (file iifmcG4VI8WQ2qbgUlVnpc)

All values below come from `get_design_context` on the component masters. Node IDs are given so a build agent can re-query
`mcp__Figma__get_design_context` for exact detail. Platform font is **Arimo** everywhere. Icons are **Lucide** (lucide-react),
rendered at their native 24px geometry unless a 20px/18px/16px box is specified; icon boxes are always centered.

Tokens: see `tokens.json`. Use CSS variables (`--bg-canvas`, `--text-primary`, …) never raw hex in components.

## Button (node 3:65) — variants Primary | Secondary | Ghost, size MD
- Height 40, padding 10px 16px, radius 10, label Arimo Bold 14/20, hugs content (no fixed width).
- Primary: bg `--bg-primary`, text `--text-on-primary`. Hover: `--bg-primary-hover`.
- Secondary: bg `--bg-surface`, 1px `--border-default`, text `--text-primary`. Hover: bg `--bg-surface-subtle`.
- Ghost: transparent, text `--text-secondary`. Hover: bg `--bg-surface-subtle`.
- Needs: focus-visible ring (`--border-focus`, 2px offset), disabled (opacity .5, no pointer), loading (spinner replaces label, keeps width).

## Button / Leading Icon (node 58:12) — variants Primary | Secondary
- Height 40, padding 8px 16px, gap 8, radius 10, icon in a 20px box (Lucide `upload`, `pencil`, `download`…), label Arimo Bold 14/20.
- Same color rules as Button. Used for: Replace run sheet (upload), Edit slide (pencil), Upload run sheet.

## Icon Button — square touch target (40 or 44 or 48), icon native 24px centered, radius 8–10. Used inside Week Switcher / Duration Stepper.

## Input (node 3:66)
- Column, gap 6. Label Arimo Bold 12/16 `--text-secondary`. Field h40, padding 10px 12px, radius 10, 1px `--border-default`,
  **transparent background** (surface-integrated — no white fill inside white cards). Value Arimo Regular 14/20 `--text-primary`;
  placeholder `--text-muted`. Focus: border `--border-focus`. Error: border `--status-error-text` + helper text in `--status-error-text` 12px.
- Helper/error slot below field (12px).

## Select (node 3:70)
- Identical chrome to Input. Right-aligned native chevron (Lucide `chevron-down`, 20px box). Locked-style select for Sunday options.

## Color Select (node 58:26)
- h40, w240 (hugs in practice), padding 8px 10px 8px 12px, radius 10, bg `--bg-surface`, border `--border-default`.
- Left: 16px swatch (radius 4) + color name Arimo Bold 14/20 `--text-primary`. Right: chevron-down 20px box.
- Options = admin-approved colors only. Render as a native `<select>` with custom trigger or an accessible listbox.

## Toggle (node 3:74)
- Track 40×24 pill; on = `--bg-primary` with white 20px knob right; off = `--border-strong` track, knob left. Label Arimo Regular 14/20 `--text-primary`, gap 10.
- Must be a `<button role="switch" aria-checked>` with an accessible label.

## Status Badge (node 3:84) — states Ready | Review | Draft | Added | Apply
- padding 4px 10px, radius 999, Arimo Bold 12/16.
- Ready → `--status-success-bg` / `--status-success-text` ("Ready")
- Review → `--status-warning-bg` / `--status-warning-text` ("Needs review")
- Draft / Added / Apply → `--bg-surface-subtle` / `--text-secondary` ("Draft", "Added to flow", "Ready to apply")
- Also seen in screens: "Exported" (subtle), "Published" (success), "Archived" (subtle), "Active" (success), "Enabled" (success), "Needs font file" (warning), "Available" (subtle), "Suggested" (info bg/text), "Failed" (error).

## Message State (node 68:1209) — states Success | Warning | Error | Info
- Row, gap 12, padding 14, radius 10, bg = `--status-{state}-bg`. Icon 24px box containing a 20px Lucide icon
  (`check-circle` for Success, `alert-circle` for Warning/Error/Info) colored `--status-{state}-text`.
- Title Arimo Bold 14 `--status-{state}-text`; message Arimo Regular 12/17 `--text-secondary`. Width fills container.
- Default copy: Success "Text fit looks good" / "Headline fits at the template's preferred size with no wrapping warnings."
  Warning "Text needs attention" / "Copy is close to the template limit. Review wrapping before export."
  Error "Text does not fit" / "Shorten this copy before exporting the slide."  Info "Template note" / "This field uses the published template's locked text-fit rules."

## Language Selector (node 83:1135) — Active EN | FR, Size SM | MD
- One segmented control. SM: h32, w88, radius 12, padding 4, segments 38×24 radius 8, label Arimo Bold 13.
  MD: h40, w104, radius 14, segments 46×32 radius 10, label Arimo Bold 14.
- Container bg `--bg-surface-subtle`, 1px `--border-default`. Active segment bg `--bg-primary` + `--text-on-primary`; inactive text `--text-secondary`.
- Semantics: `role="radiogroup"` with two `role="radio"` buttons (aria-checked), group label "Language". Announce current language.

## App Header (node 87:418) — Size Desktop (w1312) | Mobile (w375)
- h48, row, space-between, transparent/canvas background. Left: 28px `--bg-primary` rounded-8 mark + brand Arimo Bold 16 `--text-primary`
  ("Church Panels" / "Eglise Panels"), gap 10. Brand is a link to the Sunday dashboard. Right: Language Selector SM.
- Page container: max-width 1312, horizontal padding 64 on desktop (screens are 1440 wide), header top offset 40.

## Sunday Page Header (node 87:472) — Screen Dashboard | Flow | Editor | Add Slide | Upload Run Sheet
- Dashboard (h59): title Arimo Bold 32 `--text-primary` + subtitle Arimo Regular 14 `--text-secondary` (gap 6). Right: Week Switcher MD.
- Flow (h72): title Arimo Bold 30 + subtitle Arimo Regular 13 (gap 4). Right: [Upload run sheet (Secondary)] [Add slide (Secondary)] [Export ▾ (Primary trigger, h40, radius 8, chevron 16px)] gap 10.
- Editor (h56): ← arrow-left 24px + slide title Arimo Bold 24. Right: [Duplicate (Secondary)] [Save changes (Primary)].
- Add Slide (h64): ← + "Add slide" Arimo Bold 30. Right: [Cancel (Secondary)].
- Upload Run Sheet (h64): ← + "Upload run sheet" Arimo Bold 30. Right: [Cancel (Secondary)].
- Header sits 28px under App Header (App Header y=40 h48 → page header y=116).

## Week Switcher (node 68:53) — Size MD | LG
- MD: h48, w220, radius 12, padding 4, gap 4, bg `--bg-surface`, border `--border-default`. Arrow buttons 40×40 radius 8 with native 24px `arrow-left`/`arrow-right` centered. Middle: `calendar` 18px + date Arimo Bold 14.
- LG: h56, w260, arrow buttons 48×48, calendar 24px, date Arimo Bold 16.
- Date text is locale formatted ("Sunday, Sep 6" / "dimanche 6 sept.").

## Duration Stepper (node 68:1172) — Size MD | LG
- Column gap 6. Label Arimo Regular 12 (LG 13) `--text-secondary` "Default slide duration". Row: value Arimo Bold 22 (LG 26) "5 sec" left; right group gap 8 of two square buttons 40 (LG 44), radius 10, bg `--bg-surface`, border `--border-default`, native 24px `minus` / `plus` centered.
- Min 1, max 30, integer seconds. Buttons disabled at bounds.

## Safe Zones Action (node 58:25) — State Default | Hover
- h36, padding 6px 10px, radius 8, gap 8, `eye` icon in 20px box + label Arimo Bold 14 `--text-primary`. Hover bg `--bg-surface-subtle`.
- Label toggles "Show safe zones" ⇄ "Hide safe zones"; `aria-pressed`.

## Admin Nav (node 68:1637) — Active Dashboard | Sundays | Templates | Assets | Mappings | Brand | Settings
- w260, full height (1024), bg `--bg-surface`, right border `--border-default`. Brand block top; nav items; account footer pinned bottom
  (avatar, name, role · language, `more-horizontal` menu). See `screens/admin-nav.png` and query node 68:1210 for exact metrics.

## Slide Flow Card (from screens 03 Sunday Flow)
- Row h88, padding 20, gap 10, radius 12, bg `--bg-surface`, border `--border-default`. Selected: **border `--bg-primary` 2px, same background**.
- Contents: grip-vertical 24px (drag handle) · thumbnail 88×50 (real template render, radius 6) · text column (title Arimo Bold 14 "01 Welcome", meta Arimo Regular 12 "Included in MP4" or "Template match needs confirmation") · Status Badge pinned far right.
- Dashboard variant: h68, number "01" Arimo Bold 12 + thumbnail 80×45 + title Arimo Regular 14; badge far right.

## Template Card (Add Slide / Template Library)
- Column; 16:9 thumbnail (real render) 310×174 radius 12 border `--border-default`; below (gap 12): name Arimo Bold 14 `--text-primary`, meta Arimo Regular 12 `--text-secondary` ("General · Published").
- Library variant 257×270 with three lines (name, category, status).

## Filter chips (Add Slide / Template Library / Asset Library)
- h28, padding 7px 12px, radius 999, Arimo Bold 12. Active: bg `--bg-primary` text on-primary. Inactive: bg `--bg-surface-subtle` text `--text-secondary`. Gap 8. `aria-pressed`.

## Upload Dropzone (Upload Run Sheet)
- 576×280 dashed 1px `--border-strong` radius 14 bg `--bg-surface-subtle`. Centered: `upload` 24px, "Drop Word or PDF run sheet here" Arimo Bold 16, "DOCX or PDF · up to 10 MB" Arimo Regular 12 `--text-secondary`, [Choose file (Secondary)].

## Export Popover (Sunday Flow, node 52:691)
- w380, padding 20, radius 14, bg `--bg-surface`, border `--border-default`, shadow. Title "Export" Arimo Bold 18.
- "Format" label 12 → segmented JPG | MP4 (h38 container radius 10 subtle bg; selected segment bg `--bg-surface` border default, Arimo Bold 12).
- "Slides" label → three radio rows h34 radius 8 ("Current slide", "All slides", "Custom slides"); selected has `--bg-surface-subtle` bg + primary border.
- "Slide numbers" label → range Input h40 ("1–4, 6–7"). Thumbnail picker: grid 4 cols, 76×44 tiles radius 6, selected = primary border + subtle bg, number top-left Arimo Bold 10.
- Full-width primary button "Export MP4" / "Export JPG".

## Modal / dialog shell
- Overlay rgba(15,23,42,.4). Panel radius 14, bg surface, padding 24, max-w 480, title Arimo Bold 20, body 14 `--text-secondary`, actions right-aligned gap 10. Focus trap, Esc closes.
