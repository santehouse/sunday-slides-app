# Church Panels — Full Claude Code Build Handoff

**Project:** Church Panels  
**French product name:** Eglise Panels  
**Version:** MVP / build handoff  
**Primary design source:** Figma — https://www.figma.com/design/iifmcG4VI8WQ2qbgUlVnpc  
**Deployment target:** Existing Santé House Vercel Pro account  
**Primary locales:** English + Canadian French (`fr-CA`)  
**Incremental infrastructure target:** effectively $0/month at expected church usage, excluding minimal OpenAI API usage

---

# 0. READ THIS FIRST — SOURCE OF TRUTH

This file is the behavioral, architectural, data and implementation source of truth for the MVP.

The Figma file is the **visual source of truth**.

## Figma implementation rule

Only build from frames explicitly labelled:

`· CURRENT`

Never use:

- the page `90 — ARCHIVED`
- any frame prefixed `ARCHIVED ·`
- old visual iterations that happen to remain elsewhere in the file

When a CURRENT design is revised, previous versions are moved to ARCHIVED specifically so code sessions do not accidentally reference them.

## Figma page structure

- `00 — Cover & Handoff`
- `01 — Foundations`
- `02 — Components`
- `10 — Sunday Team`
- `20 — Admin`
- `30 — Flows & States`
- `90 — ARCHIVED`

## Precedence if something appears inconsistent

1. Explicit product behavior in this handoff
2. CURRENT Figma screens for visual layout and interaction intent
3. Figma component masters and tokens
4. Older notes / archived screens — ignore

Do not redesign the product during implementation unless a technical constraint makes a CURRENT behavior impossible. If that occurs, preserve the interaction goal and keep the visual deviation minimal.

---

# 1. PRODUCT SUMMARY

Church Panels is a bilingual church presentation-production tool.

It exists to replace a recurring manual Canva workflow used to prepare Sunday announcement slides.

The church currently receives a weekly run sheet, usually as a Word document and sometimes as a PDF. The product should ingest that document automatically from email or via manual upload, understand the announcements, map them to locked church-approved slide templates, insert recurring structural slides, and prepare the complete Sunday flow for a human to check.

The Sunday team should mainly be reviewing and correcting a deck that is already prepared — not designing it.

Primary pipeline:

`Pastor email / manual upload`
→ `DOCX/PDF extraction`
→ `OpenAI structured parsing`
→ `announcement mappings`
→ `template matching`
→ `default structural slides`
→ `Sunday flow`
→ `human check`
→ `JPG + MP4 export`

This is **not a mini-Canva**.

Sunday users do not get freeform graphic-design controls. The app deliberately prevents accidental brand/design drift.

---

# 2. PRODUCT BRANDING + LOCALIZATION

## Brand name

English:

`Church Panels`

French:

`Eglise Panels`

Use those exact names. Do not silently change the French brand spelling.

Internal code/project naming can use:

`church-panels`

## Full bilingual requirement

The shipped MVP must work completely in:

- English
- Canadian French (`fr-CA`)

The English Figma screens are the design source; the implementation must translate the **entire interface**, not just navigation.

There must be no English-only routes, validation messages, toasts, empty states, modal copy, button labels, errors, export states, upload states, auth states or admin settings.

### Important distinction

**UI language** and **slide content language** are separate.

Changing the app to French:

- translates the application UI
- changes the product name to `Eglise Panels`
- formats dynamic UI dates/counts in Canadian French

It must NOT automatically translate the actual church announcement copy.

If a pastor submits a French run sheet, preserve the French slide copy.
If a pastor submits an English run sheet, preserve the English slide copy.
If a document is mixed-language, preserve the original content.

Translation of slide content should happen only through a future explicit user action; it is not part of MVP.

---

# 3. I18N IMPLEMENTATION

Recommended library:

`next-intl`

Locales:

- `en`
- `fr-CA`

Recommended routing:

- English = default locale / no required prefix
- French = `/fr/...` or equivalent locale-aware routing
- language selector updates locale immediately

Persist language:

### Sunday Team
Store preference in a long-lived locale cookie/local browser preference because Sunday access is a shared PIN rather than named users.

### Admin
Store preferred locale:
- in cookie for immediate routing
- in `admin_users.locale` so it follows the admin account to another device

## Never hardcode user-facing text inside components

All user-facing UI strings must be translation keys.

Good:

```tsx
t('sunday.dashboard.slidesPrepared')
```

Bad:

```tsx
"Slides prepared"
```

Exceptions:
- user-entered slide content
- filenames
- source run sheet text
- technical identifiers that are intentionally not translated

## Dynamic formatting

Use locale-aware APIs for:
- dates
- date ranges
- numbers
- pluralization
- relative times where used

Use `Intl.DateTimeFormat` / `next-intl` formatting.

Example:

English:
`Sunday, September 6`

French:
`dimanche 6 septembre`

---

# 4. CANONICAL FR-CA UI COPY

Claude may organize translation keys differently, but the following wording establishes the intended Canadian-French tone.

Keep it clear, short and practical.

## Global

| EN | FR-CA |
|---|---|
| Church Panels | Eglise Panels |
| EN | EN |
| FR | FR |
| Save | Enregistrer |
| Save changes | Enregistrer |
| Cancel | Annuler |
| Continue | Continuer |
| Back | Retour |
| Close | Fermer |
| Delete | Supprimer |
| Duplicate | Dupliquer |
| Edit | Modifier |
| Upload | Importer |
| Export | Exporter |
| Search | Rechercher |
| Filter | Filtrer |
| All | Tous |
| Ready | Prêt |
| Needs review | À vérifier |
| Added to flow | Ajouté au déroulement |
| Ready to apply | Prêt à appliquer |

## Sunday PIN

| EN | FR-CA |
|---|---|
| Sunday team access | Accès à l’équipe du dimanche |
| Enter the shared 4-digit PIN to open this Sunday’s deck. | Entrez le NIP partagé à 4 chiffres pour ouvrir la présentation de ce dimanche. |
| Open Sunday | Ouvrir la présentation |
| Admin? Sign in with email instead. | Admin? Connectez-vous plutôt par courriel. |

## Sunday Dashboard

| EN | FR-CA |
|---|---|
| Sunday, September 6 | Dimanche 6 septembre |
| Slides prepared | Diapositives préparées |
| Needs review | À vérifier |
| Included in MP4 | Inclus dans le MP4 |
| Default slide duration | Durée par défaut des diapositives |
| Sunday flow | Déroulement du dimanche |
| Run sheet | Feuille de déroulement |
| Received by email | Reçu par courriel |
| Added to flow | Ajouté au déroulement |
| Replace run sheet | Remplacer le déroulement |
| Add slide | Ajouter une diapositive |

## Sunday Flow

| EN | FR-CA |
|---|---|
| Sunday flow | Déroulement du dimanche |
| Upload run sheet | Importer le déroulement |
| Add slide | Ajouter une diapositive |
| Export | Exporter |
| Included in MP4 | Inclus dans le MP4 |
| Template match needs confirmation | Le modèle doit être vérifié |
| Review | Vérifier |
| Edit slide | Modifier la diapositive |

## Export

| EN | FR-CA |
|---|---|
| Export | Exporter |
| Format | Format |
| Slides | Diapositives |
| JPG | JPG |
| MP4 | MP4 |
| Current slide | Diapositive actuelle |
| All slides | Toutes les diapositives |
| Custom slides | Sélection personnalisée |
| Slide numbers | Numéros des diapositives |
| Export JPG | Exporter les JPG |
| Export MP4 | Exporter le MP4 |

## Slide Editor

| EN | FR-CA |
|---|---|
| Content | Contenu |
| Template | Modèle |
| Headline | Titre |
| Line 1 | Ligne 1 |
| Line 2 | Ligne 2 |
| Background | Arrière-plan |
| Color | Couleur |
| Image | Image |
| Approved color | Couleur approuvée |
| Include in MP4 | Inclure dans le MP4 |
| Live preview | Aperçu en direct |
| Show safe zones | Afficher les zones de sécurité |
| Hide safe zones | Masquer les zones de sécurité |
| Text fit looks good | Le texte s’ajuste correctement |
| Text is too long | Le texte est trop long |
| Shorten the text before exporting. | Raccourcissez le texte avant l’exportation. |

## Add Slide

| EN | FR-CA |
|---|---|
| Add slide | Ajouter une diapositive |
| Choose a published template | Choisir un modèle publié |
| General | Général |
| Events | Événements |
| Special | Spécial |
| Giving | Dons |
| Welcome | Bienvenue |
| Theme | Thème |
| Closing | Clôture |

## Run Sheet Upload

| EN | FR-CA |
|---|---|
| Upload run sheet | Importer le déroulement |
| DOCX or PDF | DOCX ou PDF |
| Ready to apply | Prêt à appliquer |
| Merge updates | Fusionner les mises à jour |
| Replace deck | Remplacer la présentation |
| Detected announcements | Annonces détectées |
| Processing | Traitement en cours |
| Processing failed | Échec du traitement |
| Try again | Réessayer |

## Admin auth

| EN | FR-CA |
|---|---|
| Admin sign in | Connexion admin |
| Email | Courriel |
| Password | Mot de passe |
| Sign in | Se connecter |
| Email me a magic link | M’envoyer un lien de connexion |
| Use your email and password, or send yourself a magic link. | Utilisez votre courriel et votre mot de passe, ou recevez un lien de connexion. |

## Admin nav

| EN | FR-CA |
|---|---|
| Dashboard | Tableau de bord |
| Sundays | Dimanches |
| Sundays & Run Sheets | Dimanches et déroulements |
| Templates | Modèles |
| Assets | Ressources |
| Mappings | Correspondances |
| Announcement Mappings | Correspondances des annonces |
| Brand & Fonts | Marque et polices |
| Settings | Paramètres |
| Admin Users | Administrateurs |

## Template / Asset states

| EN | FR-CA |
|---|---|
| Published | Publié |
| Draft | Brouillon |
| Archived | Archivé |
| Publish | Publier |
| Archive | Archiver |
| Create template | Créer un modèle |
| Upload asset | Importer une ressource |
| Asset library | Bibliothèque de ressources |
| Template library | Bibliothèque de modèles |
| Template Studio | Studio de modèles |

Use Canadian-French wording consistently in all newly created strings as well.

---

# 5. USERS + PERMISSIONS

There are two distinct application experiences.

## A. Sunday Team

Authentication:
- shared 4-digit PIN
- no named user account required for MVP

A valid PIN creates a secure session cookie.
Do not keep re-prompting during the same Sunday/session unless the session expires.

Sunday users can:

- switch EN / FR
- access current/upcoming Sunday
- use week/date switcher
- review generated flow
- manually upload a DOCX/PDF run sheet
- replace/merge a run sheet
- edit exposed slide content
- choose a different Published template
- add a slide manually
- choose Published approved assets where the template allows
- reorder slides
- include/exclude a slide from MP4
- show/hide broadcast safe zones
- change global default slide duration
- export JPG
- export MP4

Sunday users cannot:

- edit fonts
- edit font sizes directly
- edit tracking
- edit line height
- edit template positions
- edit arbitrary colors
- upload arbitrary images
- alter template design
- create/archive/publish templates
- manage mappings globally
- manage fonts
- edit broadcast safe-zone dimensions
- access Admin

## B. Admin

Authentication:
- email + password
- magic link as a second sign-in option

Use Supabase Auth.

Data model must support multiple admin accounts from day one even if only one exists initially.

Roles:
- `owner`
- `admin`

Admin can manage:
- Sundays/run sheets
- templates
- template fields
- assets
- fonts
- announcement mappings
- default structural slides
- global safe zone
- Sunday PIN
- service settings
- admin users
- parsing/intake settings

---

# 6. SUNDAY TEAM NAVIGATION MODEL

Do NOT build an Admin-style sidebar for the Sunday Team.

The Sunday side deliberately stays simple.

Use the two-layer shell represented in CURRENT Figma screens.

## Layer 1 — App Header

Persistent on every Sunday screen.

Contains:
- Church Panels / Eglise Panels brand/home action on left
- Language Selector on right

Clicking the product brand returns to the Sunday Dashboard.

Figma component:
`App Header`

Expected component variants include:
- desktop
- mobile-ready variant

## Layer 2 — contextual Page Header

Screen-specific navigation/actions.

Examples:
- Dashboard = Sunday title + Week Switcher
- Sunday Flow = title/details + upload/add/export actions
- Slide Editor = back + slide title + duplicate/save
- Add Slide = back + title
- Upload Run Sheet = back + title

Figma component set:
`Sunday Page Header`

Do not add a second permanent navigation system.

---

# 7. CURRENT SUNDAY TEAM SCREENS

Figma page:

`10 — Sunday Team`

Build only CURRENT frames.

## 01 — PIN Access · CURRENT

Purpose:
very low-friction shared Sunday access.

Requirements:
- App Header
- Language Selector
- four-digit shared PIN
- clear action to open Sunday
- link to Admin sign-in
- support keyboard number entry
- auto-advance PIN fields
- Enter should submit once all four digits exist
- invalid PIN state must be translated

Do not expose admin controls.

---

## 02 — Sunday Dashboard · CURRENT

Purpose:
answer one question immediately:

**Is this Sunday ready?**

Current structure:
- App Header
- Sunday Page Header
- Sunday/date title
- Week Switcher
- metrics
- Sunday Flow preview list
- run sheet card

Metrics:
- slides prepared
- needs review
- included in MP4
- default slide duration

### Week Switcher

Componentized.

Use prior/next Sunday arrows with date in the middle.

Icons must use actual Lucide geometry and remain centered inside equal touch targets.

Do not scale Lucide internals in a way that distorts their component frame.

### Default slide duration

Global per-Sunday setting.

Display:
`5 sec`

Stepper:
- minus
- plus

The `–` and `+` controls are square touch targets with centered native-size icons.

Default:
5 seconds.

Reasonable MVP guardrails:
- minimum 1 second
- maximum 30 seconds
- integer seconds

Changing this affects MP4 holds globally unless a future per-slide duration feature is explicitly added. No per-slide duration in MVP.

### Run sheet state language

Use:

`Added to flow`

when the current run sheet has already been processed and applied.

Do not use:
- Parsed successfully
- Approved
- Ready for review

because this is not an approval workflow.

Replace Run Sheet uses a finished leading upload icon button component.

---

## 03 — Sunday Flow · CURRENT

This is the main Sunday working surface.

Left:
ordered draggable list of slides.

Right:
selected slide preview.

### Flow list cards

Each card contains:
- drag handle
- slide number
- actual template-rendered thumbnail
- slide title/headline
- optional MP4 inclusion text
- status pill pinned to far right

All copy content is left aligned.

The selected slide uses:
- same neutral background as every other row
- primary border indicator

Do NOT change selected-card background.

This is important because status colors must remain visually independent from the selected state.

### Slide statuses

Use practical statuses only:
- Ready
- Needs review

`Needs review` means parser/template/content uncertainty actually needs a human decision.

There is no formal approval/sign-off state.

### Preview

Shows exact 16:9 slide output.

Safe-zone guide may be visible.

Edit Slide action uses the reusable leading pencil icon button.

### Reorder

Drag and drop changes:
- Sunday Flow order
- JPG filename sequence
- MP4 order

There is only one ordering model.

Do not build a separate video playlist order.

---

# 8. EXPORT UX

Export is a popover/dropdown from the Sunday Flow page.

Do NOT create a separate dedicated Export route/page for MVP.

The previously designed export page is archived.

## Export popover

First choose format:

`JPG | MP4`

Then slide scope:

- Current slide
- All slides
- Custom slides

### Custom slide selection

Dual input pattern:

1. range field
2. visual thumbnail picker

Range syntax examples:
- `1-7`
- `1-4,6-7`
- `1,3,5-8`

The text field and thumbnail selection must remain synchronized both directions.

Example:
- tapping thumbnails 1,2,3,4,6,7 updates field to `1-4,6-7`
- entering `1-4,6-7` selects those thumbnails

Validate invalid syntax with a translated inline message.

### MP4 eligibility

Every slide has:

`Include in MP4`

This is a slide-level default eligibility rule.

- JPG export ignores it
- MP4 export respects it

Giving slides should default to excluded from MP4 unless template Admin setting says otherwise.

If custom MP4 slide selection includes an MP4-excluded slide, do not silently include it. Keep eligibility clear in UI.

---

# 9. JPG EXPORT

Output:
- 1920×1080
- JPG
- one file per slide

Filename format:

`01-[headline-title].jpg`

Examples:

`01-rendez-vous-de-la-semaine.jpg`
`02-etude-biblique.jpg`
`03-veillee-des-hommes.jpg`

Filename helper rules:
- use slide primary headline
- lowercase slug
- remove/normalize unsupported punctuation
- safely normalize accents for filename compatibility
- ensure duplicates receive a stable suffix
- prefix according to current Sunday Flow order

Download multiple slides as ZIP.

The old UI helper label about “headline based exports” is intentionally not shown; behavior simply occurs.

---

# 10. MP4 EXPORT

Output:
- 1920×1080
- H.264-compatible MP4 where practical

Default:
- 5 seconds per included slide
- hard cuts
- no transitions

Uses exact Sunday Flow order.

Most important rendering rule:

**The MP4 must use the exact same rendered slide images as JPG export.**

Do not implement a separate visual renderer for video.

Pipeline concept:

`slide renderer`
→ `JPG frames`
→ `FFmpeg`
→ `MP4`

This guarantees consistent:
- typography
- wrapping
- background
- safe areas
- positions
- fonts

Global default slide duration comes from the Sunday record.

---

# 11. SLIDE EDITOR

CURRENT Figma:
`04 — Slide Editor · CURRENT`

Sunday users get constrained editing.

## Exposed content fields

Use generic names:

- Headline
- Line 1
- Line 2

Do not label fields specifically:
- Date
- Time

because those lines may contain other copy.

Templates decide which fields exist and whether they are required.

## Template

Sunday user can switch among allowed **Published** templates.

Changing template should preserve compatible field values when possible.

## Background control

Segmented control:

`Color | Image`

### Color mode

Sunday Team does NOT use a hex picker.

Show:
- admin-approved colors only
- dropdown/select
- selected color includes visible swatch + color name
- right-aligned native select chevron

Approved colors are managed Admin-side.

### Image mode

Sunday Team cannot upload an image.

They choose from:
- Published asset library
- only assets allowed by the selected template

## Safe zones

The preview action is:

`Show safe zones`

when inactive.

`Hide safe zones`

when active.

It has a proper hover state at component level.

Do not duplicate this with another toggle in the left control panel.

## Include in MP4

Simple toggle.

Do not call this generic “Include in video”.

## Text fitting state

Use reusable `Message State` component.

Supported visual states:
- Success
- Warning
- Error
- Info

Example success:
`Text fit looks good`

Do not create different ad hoc message cards.

---

# 12. TEXT FITTING ENGINE

This is core product behavior, not cosmetic polish.

Every template text field must store rules.

Fields:

- x
- y
- width
- height
- font
- weight
- style
- preferred font size
- minimum font size
- line height
- letter spacing
- alignment
- color
- max lines
- overflow mode

Overflow modes:

### `fixed`
Preferred size is fixed.
If content does not fit:
- show error
- block export until corrected

### `auto_fit`
Reduce from preferred font size down to configured minimum size.

If it still does not fit:
- error
- block export

### `flex_height`
Allowed only on Admin-approved body-copy template regions.

Do not let text silently clip.

Do not silently shrink below Admin-configured minimum.

Sunday preview, JPG and MP4 must all use the same fitting calculation.

---

# 13. BROADCAST SAFE ZONE

The church places a live camera/video PIP in the bottom-left portion of announcement slides during service.

This is why many template designs intentionally have large negative space there.

Store one global safe-zone definition:

- x
- y
- width
- height

Coordinate system:
1920×1080.

Admin defines the exact zone.

Both:
- Template Studio
- Sunday slide preview

must be able to show it.

Visual guide:
- should clearly communicate LIVE CAMERA / SAFE ZONE
- preview-only
- never included in final export

Template Studio should warn if protected content overlaps it.

The Sunday editor can only show/hide the visualization; it cannot change dimensions.

---

# 14. ADD SLIDE

CURRENT Figma:
`05 — Add Slide · CURRENT`

Available categories:

- General
- Events
- Special
- Giving
- Welcome
- Theme
- Closing

Only `Published` templates appear.

Sunday Team can:
- select template
- proceed to editor
- edit exposed content fields

Sunday Team cannot:
- alter layout
- upload assets
- change fonts
- edit template rules

## Template thumbnails

Important build note:

Figma may contain simplified placeholder thumbnail art in some states.

The production app must generate/use an **actual rendered preview of the real template**.

Do not implement plain color + text placeholder cards as final template thumbnails.

---

# 15. UPLOAD RUN SHEET

CURRENT Figma:
`06 — Upload Run Sheet · CURRENT`

Available from:
- Sunday Team
- Admin

Accepted MVP formats:
- DOCX
- PDF

Manual upload uses the exact same backend pipeline as email intake.

Do not maintain separate parsers or logic for email/manual.

## Upload UX

After processing, show a review preview of:
- uploaded file
- detected announcements
- detected mappings/templates
- review warnings if applicable

Do not show a verbose list of backend parsing steps.

System status:

`Ready to apply`

means:
the newly uploaded document has processed successfully but has not yet been applied to the current Sunday.

If a Sunday already has a deck, offer:

### Merge updates
Preferred normal action.

Must:
- preserve manual edits where possible
- add new announcements
- update untouched generated announcements
- flag conflicts for review

### Replace deck
Explicit destructive action.

Requires confirmation.

Regenerates:
- announcements
- mappings
- default structural slides

Never silently replace the existing Sunday after an upload.

---

# 16. AUTOMATIC EMAIL INTAKE

Pastor workflow should remain unchanged.

Pastor emails the usual Word/PDF run sheet to a dedicated inbox/address.

Recommended:

Resend inbound email webhook.

Possible address concept:

`announcements@<configured-domain>`

Do not hardcode the domain.

## Pipeline

1. Receive inbound email
2. Validate webhook authenticity
3. Identify supported attachment
4. Resolve likely target Sunday
5. Store original file in R2
6. Create run sheet record
7. Extract text from DOCX/PDF locally
8. Send normalized extracted text + mapping context to OpenAI
9. Require structured JSON
10. Apply deterministic announcement mappings
11. Create/update generated announcement records
12. Insert default structural slides
13. Build Sunday flow
14. Mark uncertain records `needs_review`
15. Set run sheet status `Added to flow`

The app should be useful even if email intake fails, which is why manual upload exists prominently.

---

# 17. OPENAI PARSING

OpenAI is an intentional MVP dependency.

The user prefers reliable interpretation over saving fractions of a cent each week.

OpenAI API billing is separate from ChatGPT subscription; use project API credentials supplied via environment variables.

Keep model configurable:

```env
OPENAI_MODEL=
```

Use a model that supports reliable structured JSON output.

## AI responsibility

AI should:

- identify sections
- separate announcements
- understand English and French
- identify recurring announcements
- extract dates/times
- preserve exact weekly wording
- suggest canonical mapping
- suggest template
- classify announcement type
- provide confidence
- identify ambiguity / review reasons

AI should NOT:

- visually design slides
- choose arbitrary colors
- change typography
- invent church facts
- silently rewrite unclear text
- automatically translate slide copy

## Recommended structured output

Conceptual JSON:

```json
{
  "serviceDate": "2026-09-06",
  "documentLanguage": "fr",
  "sections": [
    {
      "title": "Rendez-vous de la semaine",
      "announcements": [
        {
          "sourceOrder": 1,
          "sourceText": "...",
          "canonicalKey": "bible-study",
          "category": "general",
          "headline": "ÉTUDE BIBLIQUE",
          "line1": "Mercredi",
          "line2": "19h00 à 20h00",
          "suggestedMappingId": null,
          "suggestedTemplateId": null,
          "confidence": 0.98,
          "reviewReasons": []
        }
      ]
    }
  ]
}
```

The exact schema may evolve, but it must be:
- strict
- validated with Zod
- auditable
- deterministic downstream

Store extracted source text and model output for debugging.

---

# 18. ANNOUNCEMENT MAPPINGS

Mappings answer:

**Which design/template belongs to this recurring announcement?**

Mappings do NOT freeze weekly copy.

Example:

`Étude biblique`
→ `Bible Study Template`

Aliases can include:

- Étude biblique
- Bible Study
- Étude de la Bible

All aliases point to the same canonical mapping.

## Important recurring-example behavior

Bible study normally happens almost every week, but occasionally it goes on break.

The mapping should still select the Bible Study template.

The weekly run sheet controls current copy.

Normal week:

`Mercredi · 19h00–20h00`

Break week:

`En pause cette semaine`

Do not overwrite the run sheet with last week’s default text.

Mapping decides **design**.

Run sheet decides **this week’s content**.

## Sunday correction

Sunday Team should be able to:
- change template for an announcement

Optionally support:
- `Remember this mapping`

This writes a reusable mapping/alias after an explicit user action.

Do not silently learn mappings from every edit without confirmation.

---

# 19. DEFAULT STRUCTURAL SLIDES

Some slides are part of the service structure and are not always written in the pastor’s weekly run sheet.

Examples include:

- Welcome to church
- Annual theme
- Rendez-vous de la semaine
- See you next week
- section divider slides

`Rendez-vous de la semaine` is especially important:
it may not appear as a separate weekly run-sheet item because it acts as a visual section cover during the service.

Admin must be able to configure a default structural slide with rules.

Suggested rule types:

### Always include
Automatically included and not normally removed.

### Include by default
Automatically included but Sunday Team can remove.

### Manual only
Available from Add Slide but never auto-inserted.

Each default can also have:
- insertion zone/order
- default template
- MP4 eligibility
- removable flag

---

# 20. ADMIN EXPERIENCE

Authenticated Admin screens use the sidebar system.

Do not reuse Sunday App Header as the primary authenticated Admin navigation.

Figma page:

`20 — Admin`

Build CURRENT frames only.

## Admin sidebar/nav

One component source of truth.

Active-page variants.

Account details at bottom.

Account footer:
- no decorative light-blue card fill
- correctly padded avatar
- admin name
- role / language metadata
- menu action
- aligned to bottom of sidebar

## Admin input styling

Text input/select fields should not have arbitrary white frame fills layered inside white surfaces.

Follow CURRENT Figma:
- clean transparent/surface-integrated fields
- border communicates field
- states remain clear

---

# 21. CURRENT ADMIN SCREENS

## 01 — Admin Sign In · CURRENT

- Church Panels branding
- in French, Eglise Panels
- email/password
- magic link
- Language Selector
- translated error/success messages

---

## 02 — Admin Dashboard · CURRENT

Overview of:
- next Sunday
- run sheet status
- unresolved review items
- templates
- assets
- mappings
- system/integration health where represented

Admin nav account details pinned bottom.

---

## 03 — Sundays & Run Sheets · CURRENT

List:
- Sunday date
- source
- processing/status
- slide count
- last update

Actions:
- create Sunday
- upload run sheet
- open Sunday
- reprocess source
- merge/replace as appropriate

---

## 04 — Template Library · CURRENT

Filters/status:
- All
- Published
- Draft
- Archived

Published:
visible to Sunday Team.

Draft:
Admin-only working state.

Archived:
preserved for historical decks but unavailable for new Sunday slides.

Do not delete a template that historical slides depend on.

---

## 05 — Template Studio · CURRENT

This is intentionally not Canva.

Admin can maintain a template through structured controls.

Template properties:

### Metadata
- name EN
- name FR
- category
- status
- thumbnail/render
- default include-in-MP4

### Canvas
- 1920×1080
- solid background
- image background

### Overlay
- none / black / white
- opacity 0–100

Overlay is especially useful for photo legibility.

### Typography
- family
- weight
- italic/style
- preferred size
- minimum size
- line height
- letter spacing
- alignment
- color
- max lines
- overflow behavior

### Field behavior
- field key
- localized admin label
- required
- Sunday Team editable yes/no
- sort order

### Position
- x
- y
- width
- height

### Safe zone
Show/hide live-camera safe zone while designing.

Warn for overlap where appropriate.

## Large bespoke template changes

For substantial new art-direction concepts:
- user may design in Canva/Figma offline
- future developer session wires the new layout into code
- Template Studio then exposes appropriate editable controls

Support a `renderer_key` / code-backed template model so not every design must be possible through a generic visual builder.

This avoids building a browser-based Canva clone.

---

# 22. ASSET LIBRARY

Admin-only upload.

Asset statuses:
- Draft
- Published
- Archived

Asset metadata:
- localized name
- category
- tags
- focal point
- crop settings
- original dimensions
- allowed template IDs

Sunday Team:
- sees Published assets only
- sees only assets allowed for selected template
- cannot upload new images

---

# 23. FONT SYSTEM

Current church design system:
- Times New Roman
- Arimo

Platform app UI:
- Arimo

Templates:
- Arimo
- Times New Roman-compatible licensed/custom font path
- any future enabled font

## Google Fonts

Build native Google Font support.

Admin should be able to enable families/weights.

## Custom font upload

Support:
- `.woff`
- `.woff2`

Store permanent font assets in R2.

Font record:
- family
- source
- weight
- style
- asset key/url
- enabled

Do not allow deletion while a Published template references the font.

## Adobe Fonts

Do not implement direct Adobe account connection in MVP.

If needed later, evaluate Adobe licensing and embedding per font/project.

---

# 24. ADMIN MOBILE

Do not invent a full mobile Admin UI in this build.

The product owner explicitly wants a short discovery sprint before designing it.

MVP priority:
- desktop Admin exactly from CURRENT Figma
- browser layout should not catastrophically break on smaller screens
- Sunday Team flow is the operational priority

Future Admin mobile concept will likely be focused “quick tools,” not a compressed full desktop dashboard, but this is deferred.

---

# 25. DESIGN SYSTEM + COMPONENT RULES

Use the Figma variables and components as the design source.

Do not recreate arbitrary CSS values by eye when a token exists.

## Platform typography

Arimo.

## Icon system

Lucide only.

Implementation library:

`lucide-react`

Use icons that correspond to the local Figma Lucide component names.

Do not mix:
- emoji icons
- Unicode arrows
- unrelated icon packs

## Key reusable Figma components

At minimum map these into reusable React components:

- App Header
- Sunday Page Header
- Language Selector
- Week Switcher
- Duration Stepper
- Button
- Leading Icon Button
- Icon Button
- Input
- Select
- Toggle
- Status Badge
- Message State
- Color Select
- Safe Zones Action
- Admin Nav
- Admin User Account footer
- Slide Flow Card
- Template Card
- Upload Dropzone
- Export Popover
- modal/dialog shell

## Component implementation requirements

Every button/control needs:
- correct padding
- native icon size
- centered icon geometry
- hover
- focus-visible
- disabled where applicable
- loading where applicable

Buttons should hug their content.

Do not hardcode arbitrary widths such as `120px` unless the actual component variant requires it.

Icon touch targets can be fixed square sizes while the icon remains native-size inside.

## Known component polish decisions

### Language Selector
One segmented component.

Variants:
- active EN
- active FR
- appropriate sizes

Do not render two disconnected pills.

### Week Switcher
One component with variants.

Arrow icons are native Lucide and must be visually centered.

### Duration Stepper
One component set.

Native plus/minus icon geometry centered in equal square controls.

### Message State
One variant component:
- Success
- Warning
- Error
- Info

Do not make ad hoc green/yellow/red helper cards.

### Admin Nav
One component with active-page variants.

Do not duplicate a hand-built sidebar per screen.

---

# 26. FIGMA TOKEN NAMES

Figma currently contains primitive + semantic variables.

Prefer semantic tokens in code.

Important semantic examples:

- `bg/canvas`
- `bg/surface`
- `bg/surface-subtle`
- `bg/primary`
- `bg/primary-hover`
- `text/primary`
- `text/secondary`
- `text/muted`
- `text/on-primary`
- `border/default`
- `border/strong`
- `border/focus`
- `status/success-bg`
- `status/success-text`
- `status/warning-bg`
- `status/warning-text`
- `status/error-bg`
- `status/error-text`
- `status/info-bg`
- `status/info-text`

Primary direction in the current system is an indigo/purple family.

Do not use this handoff to guess all hex values. Pull the values from Figma variables / CURRENT design system when implementing.

If translating Figma variables to CSS:

```css
--bg-canvas
--bg-surface
--bg-surface-subtle
--bg-primary
--text-primary
...
```

Use a stable token layer rather than sprinkling raw hex values throughout components.

---

# 27. TECH STACK — LOCKED MVP DIRECTION

## Application
- Next.js
- TypeScript
- App Router

## Hosting / deployment
- existing Santé House Vercel Pro account

## Database
- Supabase Postgres — free tier initially

## Admin authentication
- Supabase Auth

## File/object storage
- Cloudflare R2

## Email
- Resend
- inbound email webhook for run sheets
- outbound/auth-related app email where needed

## AI
- OpenAI API

## DOCX extraction
Use a maintained server-side DOCX parser.

Common option:
- `mammoth`

Preserve enough structure/order for AI interpretation.

## PDF extraction
Use a maintained server-side PDF text extraction library.

Avoid OCR unless actual PDF contains no usable text.

If extraction produces empty/unusable text:
- mark needs review
- allow Admin/Sunday manual resolution
- do not silently hallucinate from filename

## Rendering
One shared slide renderer.

Browser/HTML/CSS-based rendering is acceptable if deployable in Vercel constraints.

Keep renderer behind an abstraction so implementation can use:
- headless Chromium
- or another deterministic renderer

without changing template/data model.

## Video
FFmpeg using the renderer’s exact JPG output.

---

# 28. COST CONSTRAINT

Goal:
no new recurring infrastructure bill at current church usage.

Existing:
- Vercel Pro already paid

Intended:
- Supabase free
- R2 free tier
- Resend free tier
- OpenAI pay-as-you-go minimal weekly usage

Do not introduce:
- paid queues
- paid CMS
- paid auth vendor
- paid image-render SaaS
- paid video-render SaaS

unless absolutely required and explicitly approved.

---

# 29. R2 STORAGE MODEL

## Permanent objects

Do not auto-delete:
- template artwork
- Published/Draft asset originals needed by current templates
- font uploads

Suggested prefixes:

```text
templates/
assets/
fonts/
```

## Temporary / 60-day lifecycle

Auto-delete after 60 days:
- incoming run sheet originals
- generated JPG files
- JPG ZIP files
- generated MP4
- temporary render artifacts

Suggested prefixes:

```text
run-sheets/
exports/jpg/
exports/zip/
exports/mp4/
tmp/
```

Configure R2 lifecycle rules rather than relying only on application cleanup.

Historical metadata stays in Supabase even after binary exports expire.

---

# 30. RECOMMENDED SUPABASE DATA MODEL

Exact naming can change slightly for code conventions, but keep these domain boundaries.

## `admin_users`

```text
id uuid pk
auth_user_id uuid unique
display_name text
email text
role enum(owner, admin)
locale text default 'en'
created_at timestamptz
disabled_at timestamptz nullable
```

## `app_settings`

Single-tenant MVP record.

```text
id
church_name
timezone
default_locale
sunday_pin_hash
default_slide_hold_seconds
inbound_email
pip_x
pip_y
pip_width
pip_height
temporary_retention_days default 60
created_at
updated_at
```

## `sundays`

```text
id uuid pk
service_date date unique
status enum(draft, needs_review, ready, exported)
source_run_sheet_id uuid nullable
default_slide_hold_seconds integer
created_at
updated_at
```

## `run_sheets`

```text
id
sunday_id
source_type enum(email, manual)
original_filename
mime_type
r2_key
extracted_text
parse_status enum(queued, processing, ready_to_apply, added_to_flow, needs_review, failed)
parse_error
parsed_json jsonb
received_at
processed_at
```

## `templates`

```text
id
slug
name_en
name_fr
category
status enum(draft, published, archived)
renderer_key
background_type
background_value
overlay_color enum(none, black, white)
overlay_opacity numeric
include_in_video_default boolean
created_at
updated_at
```

`renderer_key` allows bespoke code-defined template layouts.

## `template_fields`

```text
id
template_id
field_key
field_type
label_en
label_fr
team_editable boolean
required boolean
x
y
width
height
font_id
font_size
min_font_size
font_weight
font_style
line_height
letter_spacing
alignment
text_color
max_lines
overflow_mode enum(fixed, auto_fit, flex_height)
sort_order
```

## `assets`

```text
id
name_en
name_fr
status enum(draft, published, archived)
category
r2_key
mime_type
width
height
focal_x
focal_y
crop_metadata jsonb
created_at
updated_at
```

## `template_assets`

```text
template_id
asset_id
```

## `approved_colors`

Recommended table because Sunday users choose from a controlled list.

```text
id
name_en
name_fr
hex
enabled
sort_order
```

Optional:
template-specific linking table if not all colors apply to all templates.

## `fonts`

```text
id
family
source enum(google, custom)
source_identifier
r2_key nullable
weight
style
enabled
created_at
```

## `announcement_mappings`

```text
id
canonical_name
template_id
active
created_at
updated_at
```

## `announcement_aliases`

```text
id
mapping_id
alias
locale nullable
```

## `slides`

```text
id
sunday_id
template_id
headline
content_json jsonb
asset_id nullable
background_mode enum(color, image)
approved_color_id nullable
sort_order
include_in_video boolean
status enum(ready, needs_review, invalid)
is_structural boolean
parser_confidence nullable
mapping_id nullable
source_announcement_json jsonb nullable
created_at
updated_at
```

## `default_structural_slides`

```text
id
template_id
insertion_rule
default_sort_zone
enabled
removable_by_sunday_team
include_in_video_default
```

## `export_jobs`

```text
id
sunday_id
type enum(jpg, jpg_zip, mp4)
status enum(queued, processing, complete, failed)
selection_json jsonb
output_r2_key
error
created_at
completed_at
```

## `system_checks`

Useful for scheduled maintenance.

```text
id
check_type
status
details jsonb
created_at
```

---

# 31. SUPABASE SECURITY

Enable RLS.

Admin browser clients:
use authenticated Supabase session.

Service-role key:
server-only.

Never expose service role in:
- browser JS
- `NEXT_PUBLIC_*`
- source maps

Sunday Team access is not a Supabase user.

Implement server-mediated Sunday session:

1. user submits PIN
2. server compares with securely hashed PIN
3. issue signed/httpOnly session cookie
4. Sunday API routes validate that cookie

Hash:
- Argon2 or bcrypt

Rate-limit PIN attempts enough to avoid trivial brute force.

Do not store plain PIN.

---

# 32. RESEND INBOUND

Store webhook secret where available.

Inbound handler should:
- verify request
- deduplicate event
- reject unsupported attachments safely
- avoid processing huge/untrusted files without size checks
- sanitize filenames
- never execute attachments

Accepted:
- `.docx`
- `.pdf`

If multiple supported attachments exist:
- pick according to defined rule or create Admin review
- do not randomly parse every file and merge without visibility

---

# 33. SCHEDULED MAINTENANCE JOB

Run approximately every 48 hours.

Useful tasks:
- ensure upcoming Sunday record exists if appropriate
- check whether next Sunday has a run sheet
- check failed parsing jobs
- check failed export jobs
- write lightweight system health record
- clean stale application metadata where relevant

This job also creates regular legitimate database activity.

Do not build a meaningless ping loop.

Do not assume it is a contractual guarantee against any third-party free-tier inactivity policy; app must still fail gracefully if an external service is temporarily unavailable.

---

# 34. TEMPLATE RENDERER ARCHITECTURE

Create a single render contract.

Conceptual:

```ts
type RenderSlideInput = {
  template: TemplateDefinition
  slide: Slide
  assets: ResolvedAsset[]
  fonts: ResolvedFont[]
  safeZone?: SafeZone
  showSafeZone?: boolean
}

renderSlide(input): Promise<RenderedSlide>
```

`showSafeZone` is true for editor previews when toggled.

Exports always use:

`showSafeZone = false`

The same template definitions must power:
- browser preview
- JPG generation
- MP4 source frames

Avoid three separate layout implementations.

---

# 35. TEMPLATE DESIGN STRATEGY

Use two template approaches behind one API.

## Generic configurable templates

Defined mostly through:
- template fields
- background
- typography
- overlays

## Bespoke code-backed templates

For more complex designs.

Use:
`renderer_key`

Example:

```text
event-coral-editorial-v1
conference-special-v1
photo-theme-v1
```

A future Claude/dev session can implement a new bespoke renderer after the product owner designs it externally.

Template Studio should then expose only allowed parameters.

---

# 36. FONTS + SERVER RENDERING

The preview/export system must explicitly load fonts.

Do not depend on fonts being installed on the local computer/server.

Google:
- fetch/load requested family/weights in a controlled way

Custom:
- load WOFF/WOFF2 from R2

Font rendering should be deterministic between:
- browser
- JPG
- video

Times New Roman licensing may require a licensed font asset. Do not bundle proprietary font files without appropriate rights.

Architecture must support replacing it with an approved equivalent without rewriting templates.

---

# 37. STATUS MODEL

Keep product states simple.

## Run sheet

- queued
- processing
- ready to apply
- added to flow
- needs review
- failed

## Slide

- ready
- needs review
- invalid

No “approval” workflow in MVP.

The user explicitly does not want a misleading approval/sign-off state.

---

# 38. ERROR HANDLING

Never let AI/backend failure appear as a successful Sunday.

Examples:

### Failed DOCX extraction
Show:
`Processing failed`
with retry/manual options.

### AI JSON validation fails
Retry with constrained structured-output repair once.
If still invalid:
mark `needs_review` / failed and retain source text.

### Unknown announcement
Create an announcement with:
- source text
- best-effort structured fields
- no forced mapping
- Needs review

### Text overflow
Prevent export until fixed.

### Missing required template field
Prevent export for that slide.

### MP4 render failure
JPG export should remain available.

### Email ingest failure
Manual upload remains available.

---

# 39. RESPONSIVENESS

## Sunday Team

Desktop-first control-room UI.

CURRENT Figma desktop is source of truth.

Components are being structured with desktop/mobile-ready variants where appropriate:
- App Header
- Language Selector
- Week Switcher
- Duration controls

Do not invent a full alternative mobile Sunday IA unless necessary.

Ensure basic responsive behavior:
- no clipped controls
- readable cards
- editor can stack on smaller viewport if needed

## Admin

Desktop-first.

Full mobile Admin UX is deferred for a separate discovery/design sprint.

Do not burn build time inventing a mobile Admin product that has not been approved.

---

# 40. ACCESSIBILITY

Minimum:
- keyboard navigation
- visible focus states
- semantic buttons/inputs
- accessible label relationships
- contrast consistent with Figma accessible token set
- do not communicate status using color alone
- segmented controls need proper `aria-pressed` / radio semantics
- toggles need accessible labels
- range/custom export selection must be usable by keyboard
- drag order should have keyboard-accessible fallback if practical

Language selector:
- current language state announced
- setting document `lang` correctly:
  - `en`
  - `fr-CA`

---

# 41. EXPECTED ROUTE SHAPE

Exact naming can vary but keep domains clear.

Suggested:

```text
/
  → Sunday access/dashboard

/sunday
/sunday/[date]
/sunday/[date]/flow
/sunday/[date]/slide/[slideId]
/sunday/[date]/add
/sunday/[date]/upload

/admin/sign-in
/admin
/admin/sundays
/admin/sundays/[id]
/admin/templates
/admin/templates/[id]
/admin/assets
/admin/mappings
/admin/brand
/admin/settings
```

French locale routing can wrap this through `next-intl`.

---

# 42. API / SERVER ACTION DOMAINS

Keep backend logic separated by concern.

Suggested modules:

```text
lib/
  auth/
  i18n/
  supabase/
  r2/
  resend/
  openai/
  run-sheets/
  mappings/
  templates/
  renderer/
  exports/
  fonts/
  sunday/
```

Avoid one giant server-actions file.

---

# 43. ENVIRONMENT VARIABLES

Create `.env.example`.

Suggested:

```env
# App
NEXT_PUBLIC_APP_URL=
APP_URL=
CRON_SECRET=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_ENDPOINT=

# Resend
RESEND_API_KEY=
RESEND_INBOUND_WEBHOOK_SECRET=
RESEND_FROM_EMAIL=
RUN_SHEET_INBOUND_EMAIL=

# OpenAI
OPENAI_API_KEY=
OPENAI_MODEL=
```

Do not commit real secrets.

---

# 44. IMPLEMENTATION ORDER

Build in this order to minimize rework.

## Phase 1 — project foundation
- Next.js + TS
- lint/format/test
- token layer
- Arimo app font
- Lucide
- i18n EN + fr-CA
- global layout

## Phase 2 — Supabase
- schema migrations
- RLS
- Admin auth
- admin user model
- settings
- Sunday PIN session

## Phase 3 — reusable UI system
Implement Figma components first:
- buttons
- inputs/selects/toggles
- App Header
- Language Selector
- Page Header
- Week Switcher
- Duration Stepper
- Status Badge
- Message State
- Admin Nav
- slide cards
- popovers/dialogs

Do not build every screen with one-off Tailwind fragments.

## Phase 4 — Sunday UI
Build CURRENT Figma:
1. PIN Access
2. Dashboard
3. Sunday Flow
4. Slide Editor
5. Add Slide
6. Upload Run Sheet
7. Export popover

Mock real domain data initially.

## Phase 5 — Admin UI
Build CURRENT:
1. Sign In
2. Dashboard
3. Sundays & Run Sheets
4. Template Library
5. Template Studio
6. Asset Library
7. Announcement Mappings
8. Brand & Fonts
9. Settings & Admin Users

## Phase 6 — R2
- uploads
- permanent/temporary prefixes
- signed reads as needed
- lifecycle documentation

## Phase 7 — parsing
- DOCX
- PDF
- OpenAI structured output
- mappings
- default structural slides
- merge/replace behavior

## Phase 8 — email intake
- Resend inbound
- duplicate protection
- same processing pipeline as manual upload

## Phase 9 — rendering
- preview
- text fitting
- custom fonts
- safe zones
- JPG

## Phase 10 — MP4
- frame selection
- global duration
- FFmpeg
- upload result R2

## Phase 11 — QA
- complete bilingual pass
- visual Figma pass
- acceptance tests
- deployment

---

# 45. TESTING REQUIREMENTS

Use:
- unit tests for parser/range logic
- integration tests for run-sheet processing
- Playwright or equivalent for core user paths

## Critical unit tests

### Export range parser

Valid:
- `1-7`
- `1-4,6-7`
- `1,3,5`

Invalid:
- `0`
- negative numbers
- malformed commas/ranges
- out-of-range slides

Field ↔ thumbnails sync.

### Text fit
- fits preferred
- shrinks to minimum
- still overflows
- max lines exceeded

### Mapping
- EN alias
- FR alias
- same canonical mapping
- weekly changed copy preserved

### Structural slides
- inserted despite absence in run sheet
- correct insertion position
- removable/default behavior

### Locales
For every CURRENT route:
- EN renders
- FR-CA renders
- no missing translation key
- no unintended English text in FR interface

---

# 46. END-TO-END ACCEPTANCE SCENARIOS

## Scenario A — normal email week

1. pastor sends DOCX
2. webhook receives
3. document stored
4. parser extracts
5. OpenAI structures
6. recurring announcements map
7. structural slides inserted
8. Sunday appears on Dashboard
9. one uncertain item marked Needs review
10. team corrects it
11. all content fits
12. JPG ZIP exports
13. MP4 exports with correct flow/order

## Scenario B — Bible study is on break

Mapping still picks Bible Study template.

Run sheet says break.

Generated slide uses current break copy.

System must not restore standard Wednesday/time copy from previous weeks.

## Scenario C — structural section cover missing from run sheet

Pastor does not explicitly mention:
`Rendez-vous de la semaine`

Admin default says include.

System inserts it automatically before appropriate weekly section.

## Scenario D — Sunday last-minute upload

Sunday Team uploads revised DOCX.

System processes.

Shows:
`Ready to apply`

Team selects:
`Merge updates`

Existing manual edits remain where non-conflicting.

New items appear.

Conflicts get Needs review.

## Scenario E — manual new announcement

Pastor mentions something at rehearsal.

Sunday user:
- Add Slide
- select Published template
- edit Headline / Line 1 / Line 2
- choose approved color or approved image
- save
- slide joins Sunday Flow

## Scenario F — FR interface

Sunday user switches to FR.

Immediately:
- product brand becomes Eglise Panels
- all app controls become Canadian French
- date formatting becomes French
- actual announcement slide copy does NOT translate automatically

Admin user switches to FR:
- all Admin navigation/forms/messages translate
- preference persists

---

# 47. DESIGN QA CHECKLIST

Before calling build complete:

- [ ] All CURRENT Figma screens implemented
- [ ] No ARCHIVED screen referenced
- [ ] Church Panels shown in EN
- [ ] Eglise Panels shown in FR-CA
- [ ] EN/FR control uses one segmented component
- [ ] Sunday App Header reused everywhere
- [ ] Sunday Page Header reused
- [ ] Admin Nav is one reusable component
- [ ] Admin account footer aligned/pinned bottom
- [ ] Lucide only
- [ ] No Unicode-arrow stand-ins
- [ ] Buttons hug labels
- [ ] Icon geometry centered
- [ ] Week Switcher matches master
- [ ] Duration Stepper matches master
- [ ] selected Sunday slide uses border, not colored fill
- [ ] flow status remains far right
- [ ] approved color uses select + swatch
- [ ] safe-zone action supports Show / Hide
- [ ] message cards use Message State variants
- [ ] Add Slide uses real template thumbnails
- [ ] Admin fields match CURRENT transparent/surface treatment
- [ ] all FR UI strings are translated
- [ ] no text clipping in EN or FR

---

# 48. FUNCTIONAL QA CHECKLIST

- [ ] 4-digit Sunday PIN works
- [ ] password Admin auth works
- [ ] Admin magic link works
- [ ] second Admin can be created later
- [ ] email intake works
- [ ] manual DOCX upload works
- [ ] manual PDF upload works
- [ ] manual and email use same pipeline
- [ ] OpenAI output schema validated
- [ ] recurring mappings work
- [ ] aliases EN/FR work
- [ ] default structural slides work
- [ ] slide drag ordering persists
- [ ] global duration persists
- [ ] text overflow blocks export
- [ ] safe zone never appears in export
- [ ] JPG names follow index + headline
- [ ] JPG ZIP works
- [ ] MP4 respects flow order
- [ ] MP4 respects Include in MP4
- [ ] MP4 uses exact JPG visuals
- [ ] temporary R2 outputs expire at 60 days
- [ ] permanent template/assets/fonts do not expire

---

# 49. WHAT IS NOT MVP

Do not expand scope into:

- full Canva-style freeform editor
- Sunday image uploads
- arbitrary Sunday hex/color selection
- per-slide duration controls
- complex video transitions
- individual Sunday Team user accounts
- formal slide approvals
- full mobile Admin redesign
- Adobe Fonts account integration
- marketplace / multi-church SaaS tenancy
- automatic slide-content translation

The architecture should not deliberately block future evolution, but do not spend MVP time building these.

---

# 50. IMPORTANT PRODUCT PRINCIPLES

## The Sunday team should almost never design

They:
- check
- correct
- reorder
- export

Admin owns design.

## AI interprets; templates design

OpenAI understands the weekly run sheet.

It does not decide aesthetics.

## One source of layout truth

Preview = JPG = MP4 frame.

## One source of order truth

Sunday Flow = export order.

## Bilingual is not an afterthought

Do not finish English and then patch French at the end.

Build every component against translation keys from day one.

## Keep Sunday extremely simple

Do not add sidebar navigation to Sunday Team.

The persistent App Header + contextual Page Header is intentional.

---

# 51. FIRST BUILD-SESSION INSTRUCTION FOR CLAUDE CODE

When starting a fresh Claude Code session, use this brief and the CURRENT Figma file as source of truth.

Recommended initial instruction:

> Build the Church Panels MVP described in `CHURCH_PANELS_CLAUDE_CODE_BUILD_HANDOFF.md`. Start by inspecting the CURRENT Figma screens and tokens/components. Do not reference anything on `90 — ARCHIVED`. Scaffold the Next.js/TypeScript app, Supabase schema/auth foundation, `next-intl` EN + `fr-CA` localization, tokenized component system and the complete Sunday Team CURRENT UI before moving into Admin and backend integrations. Every UI string must exist in both English and Canadian French from the start. English product name is `Church Panels`; French product name is `Eglise Panels`. Preserve slide/run-sheet content language independently from the app UI language. Keep implementation component-driven, use Lucide icons only, and match the CURRENT Figma layouts rather than redesigning them.

---

# 52. FINAL DEFINITION OF DONE

The MVP is done when a real weekly church DOCX/PDF can be emailed or manually uploaded, Church Panels can parse it, generate the expected Sunday flow with recurring/default slides, allow a volunteer to review and correct it without touching design styling, then export accurate JPGs and an MP4 loop — with the entire application fully usable in English or Canadian French.

The French interface must be a first-class product, not an English UI with a few translated buttons.

