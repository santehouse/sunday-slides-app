# Church Panels — hand-off

## Where things are
- **Repo branches:** `main` = production, `staging` = staging (mock data), `claude/project-build-brief-review-of0uu6` = feature work.
- **Production:** https://eajc.sundaytomonday.church (Vercel team Santé House, project `church-panels`) — real Supabase data.
- **Staging:** https://church-panels-staging.vercel.app — runs with `CP_MOCK_DATA=1` (in-memory demo Sunday, PIN `53787`, admin sign-in accepts any email/password). Push to `staging` to update it.
- **Inbound email:** `announcements@eajc.sundaytomonday.church` (Resend inbound webhook → `/api/inbound/resend`).

## Going live on real data (done for production — repeat for a new environment)
1. Apply migrations: `SUPABASE_ACCESS_TOKEN=sbp_… SUPABASE_PROJECT_REF=… pnpm tsx --tsconfig scripts/tsconfig.json scripts/db-migrate.ts`
   (re-run after every new file in `supabase/migrations/` — `0002_run_sheet_opened_at.sql` is pending on production until the single-screen Sunday UI ships).
2. Seed: `pnpm seed` with `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_SUNDAY_PIN` (uses `SUPABASE_SERVICE_ROLE_KEY`).
3. Supabase Auth → URL configuration: Site URL + `…/api/auth/callback` redirect for the environment's domain.
4. Leave `CP_MOCK_DATA` unset in the Vercel **production** environment; set it to `1` on preview/staging.
5. Resend (full-access key): `RESEND_API_KEY=re_… pnpm tsx --tsconfig scripts/tsconfig.json scripts/resend-setup.ts` → add the printed DNS records, put the webhook signing secret into `RESEND_INBOUND_WEBHOOK_SECRET` on Vercel.
6. OpenAI: `OPENAI_MODEL=gpt-4.1`; without a key the offline heuristic parser is used.
7. R2 bucket `church-panels` with 60-day expiry on `run-sheets/`, `exports/`, `tmp/`.

## Weekly flow (single-screen Sunday UI)
The Sunday team opens `/sunday` with the PIN and lands on one queue: the slides of the **coming Sunday** (today if today is a Sunday). There is no date navigation.
- **Import announcements** → upload a DOCX/PDF, or pick one of the last six files received by email (received date, "new" dot, preview). AI parsing runs only when a file is selected, then the slides are added to the queue.
- **New slide** → pick a published template and fill it in. **Pencil** edits a slide in a modal; **film** toggles it in/out of the video; **trash** removes it (double confirm).
- **Export** (top-right) → JPG ZIP or MP4; "Advanced" expands hold-time and range options. **Clear queue** (double confirm) empties the service.
- Slides in Sunday Flow order = JPG numbering = MP4 order.

## Brand templates (rebuilt from the Canva "Panel" file)
Definitions live in `src/lib/data/brandTemplates.ts` (exact Canva geometry, fonts, colours) and seed the mock/staging data automatically.
To apply them to production (after migration `0003_template_field_layers.sql`):
```
NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… pnpm tsx --tsconfig scripts/tsconfig.json scripts/apply-brand-templates.ts
```
Upload the three background pictures under Admin → Assets first, named exactly **Annual theme sky**, **Baptêmes water**, **Conference gold** (publish them); the script binds them by name and otherwise applies a solid stand-in colour. The display serif is **Times New Roman** (upload the licensed files under Brand & Fonts; the metric-compatible Tinos stands in until then).
Field text accepts `*bold*` and `_italic_` around words. Locked fields (church name, dots, the theme line) always show their template default; the Sunday team only sees the editable ones.

## Development
`pnpm dev` (mock mode when `CP_MOCK_DATA=1` or Supabase env missing) · `pnpm check` · `pnpm test:e2e` · `pnpm engine:bundle` (auto-run by `pnpm build`).
See `docs/OPERATIONS.md`, `docs/RENDERING.md`, `docs/INTAKE.md`, `docs/QA_REPORT.md`.
