# Church Panels — hand-off

## Where things are
- **Repo branch:** `claude/project-build-brief-review-of0uu6` (Vercel production branch until `main` exists).
- **Live URL:** https://church-panels.vercel.app (Vercel team Santé House, project `church-panels`).
- **Demo mode:** production currently runs with `CP_MOCK_DATA=1` (in-memory demo data). Sunday PIN `53787`; admin sign-in accepts any email/password. Flip it off once the database is migrated and seeded (see below).

## Going live on real data
1. Apply migrations: `SUPABASE_ACCESS_TOKEN=sbp_… SUPABASE_PROJECT_REF=ooeoyjosimxszebaydkj pnpm tsx --tsconfig scripts/tsconfig.json scripts/db-migrate.ts`
2. Seed: `pnpm seed` with `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_SUNDAY_PIN` (uses `SUPABASE_SERVICE_ROLE_KEY`).
3. Supabase Auth → URL configuration: Site URL `https://church-panels.vercel.app`, redirect `https://church-panels.vercel.app/api/auth/callback`.
4. Remove `CP_MOCK_DATA` from the Vercel **production** environment and redeploy.
5. Resend (full-access key): `RESEND_API_KEY=re_… pnpm tsx --tsconfig scripts/tsconfig.json scripts/resend-setup.ts` → add the printed DNS records at GoDaddy, put the webhook signing secret into `RESEND_INBOUND_WEBHOOK_SECRET` on Vercel.
6. OpenAI: add credit to the project; `OPENAI_MODEL=gpt-4.1` is set.
7. R2 bucket `church-panels` exists with 60-day expiry on `run-sheets/`, `exports/`, `tmp/` (done).

## Weekly flow
Pastor emails the DOCX/PDF to `announcements@sundaytomonday.church` → parsed → Sunday flow prepared → team opens the PIN link, reviews "Needs review" items, exports JPG ZIP + MP4.
Manual upload: Sunday → Upload run sheet → Merge updates / Replace deck.

## Development
`pnpm dev` (mock mode when `CP_MOCK_DATA=1` or Supabase env missing) · `pnpm check` · `pnpm test:e2e` · `pnpm engine:bundle` (auto-run by `pnpm build`).
See `docs/OPERATIONS.md`, `docs/RENDERING.md`, `docs/INTAKE.md`, `docs/QA_REPORT.md`.
