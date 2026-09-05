# Church Panels — engineering conventions

Bilingual (EN + fr-CA) church slide production tool. Source of truth for behaviour: `docs/BUILD_HANDOFF.md`.
Visual source of truth: Figma file `iifmcG4VI8WQ2qbgUlVnpc`, CURRENT frames only — see `design/figma/*.md` for node ids, tokens and component specs.
Never reference the Figma page `90 — ARCHIVED`.

## Stack
Next.js 16 (App Router, `src/`), TypeScript strict, Tailwind v4 (tokens in `src/app/globals.css`), next-intl 4, lucide-react,
Supabase (Postgres + Auth), Cloudflare R2 (S3 API), Resend, OpenAI, puppeteer-core + @sparticuz/chromium, ffmpeg-static, Vitest, Playwright.
Package manager: **pnpm**. Node 22.

## Commands
`pnpm dev` · `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm i18n:check` · `pnpm check` (all of the above) · `pnpm test:e2e`.
Run `pnpm check` before every commit. Do not commit with failures.

## Non-negotiable rules
1. **No hardcoded user-facing strings.** Every visible string comes from `messages/en.json` + `messages/fr-CA.json` via `useTranslations` / `getTranslations`. Add keys to BOTH files in the same change. Exceptions: slide content, filenames, run-sheet text, technical ids.
2. **Tokens only.** Use Tailwind utilities backed by tokens (`bg-surface`, `text-fg-secondary`, `border-border`, `rounded-lg`, `text-label`…) or `var(--…)`. No raw hex/px colors in components. Radii: `rounded-sm`(6) `rounded-md`(10) `rounded-lg`(14) `rounded-xl`(18) `rounded-2xl`(24).
3. **Lucide only** via `lucide-react`. Native 24px geometry inside fixed square touch targets; pass `size={20}` only where the Figma spec says 20/18/16. No emoji, no unicode arrows.
4. **Reusable components first.** Everything in `design/figma/components.md` lives in `src/components/ui/` (one file per component, named exports, `cn()` from `@/lib/utils/cn`). Screens compose these — no one-off Tailwind fragments for things that are components in Figma.
5. **Buttons hug their labels.** No arbitrary widths. Every control has hover, focus-visible, disabled, and loading (where async) states.
6. **One renderer.** Browser preview, JPG and MP4 all use `src/lib/renderer/` (`SlideCanvas` React component + `fitText` engine). Never draw slides a second way.
7. **One order.** `slides.sort_order` is Sunday Flow order = JPG numbering = MP4 order.
8. **Slide content language is independent of UI language.** Never translate slide copy.
9. **Status vocabulary** — run sheet: queued/processing/ready_to_apply/added_to_flow/needs_review/failed. Slide: ready/needs_review/invalid. No "approved".
10. **Secrets server-only.** `SUPABASE_SERVICE_ROLE_KEY`, R2, Resend, OpenAI keys are only read in `src/lib/**` server modules (`import "server-only"`). Never in client components or `NEXT_PUBLIC_*`.
11. **Accessibility**: semantic buttons/inputs, labels wired with `htmlFor`/`aria-label`, `aria-pressed` for toggles/segmented controls, radio semantics for exclusive choices, keyboard reorder fallback, `lang` set per locale.

## Architecture
```
src/app/[locale]/(sunday)/sunday/...        Sunday Team routes (PIN-gated in the group layout)
src/app/[locale]/admin/...                  Admin routes (Supabase-auth gated in layout)
src/app/api/...                             Route handlers: inbound email webhook, cron, exports, uploads
src/components/ui/                          Figma component masters (Button, Input, Select, Toggle, StatusBadge, MessageState, …)
src/components/sunday/  src/components/admin/   Screen-level composites
src/lib/domain/types.ts                     Shared domain types (mirror of supabase/migrations)
src/lib/data/                               Repository layer: `getDb()` returns the Supabase service client OR the in-memory mock when CP_MOCK_DATA=1
src/lib/auth/                               Sunday PIN session (jose-signed httpOnly cookie) + admin session helpers
src/lib/engines/                            Pure TS: textFit, exportRange, slugFilename, mappingMatcher, structuralInsert, mergeRunSheet
src/lib/renderer/                           SlideCanvas (React, absolute layout at 1920×1080 scaled by CSS), fitText, server renderer (Chromium → JPEG)
src/lib/exports/                            JPG zip + MP4 (ffmpeg) + R2 upload
src/lib/run-sheets/                         extract (mammoth / unpdf) → parse (OpenAI structured) → apply (mappings, structural, merge/replace)
src/lib/r2/  src/lib/resend/  src/lib/openai/  src/lib/fonts/
messages/en.json  messages/fr-CA.json       Translation catalogs (key parity enforced by pnpm i18n:check)
supabase/migrations/                        SQL migrations (0001_init.sql is the schema contract)
```
Server Actions live next to the route that owns them (`actions.ts`), thin, calling `src/lib/**`. No giant actions file.

## Data access
All Sunday-team and admin reads/writes go through `src/lib/data/*` repositories. Sunday Team is NOT a Supabase user — server code uses the service-role client after validating the Sunday session cookie. Admin server code validates the Supabase session (`@supabase/ssr`) and then also uses the service client (RLS remains the safety net for any browser-side reads).

## Mock mode
`CP_MOCK_DATA=1` makes `getDb()` return an in-memory store seeded with the Figma demo Sunday (Sep 6: Welcome, Je suis avec vous, Rendez-vous de la semaine, Étude biblique, Baptêmes, Veillée des hommes (needs review), Prière matinale des femmes, À la semaine prochaine) and the demo templates/assets/mappings. Every screen must work in mock mode — that is what Playwright and design QA run against.

## Testing
Unit tests colocated (`*.test.ts`) or in `tests/unit`. Playwright specs in `tests/e2e` run against mock mode for EN and FR-CA.

## Git
Branch `claude/project-build-brief-review-of0uu6`. Conventional commit messages (`feat(sunday): …`, `fix(renderer): …`). Small, frequent commits.
