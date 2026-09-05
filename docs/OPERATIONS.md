# Operations

## Environments
- **Local / QA:** `CP_MOCK_DATA=1 pnpm dev` runs the full UI against the in-memory demo dataset. No external services needed.
- **Production:** Vercel (Santé House team) + Supabase + Cloudflare R2 + Resend + OpenAI. All secrets in Vercel project env vars; see `.env.example`.

## First deploy checklist
1. `pnpm check` green on the branch.
2. Supabase: apply `supabase/migrations/*.sql` (`supabase link --project-ref <ref>` then `supabase db push`, or paste into the SQL editor).
3. `pnpm seed` with `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_SUNDAY_PIN` set — creates the owner admin, templates, colors, mappings, structural defaults, settings.
4. R2: create bucket `church-panels`; lifecycle rules expiring `run-sheets/`, `exports/`, `tmp/` after 60 days (`pnpm tsx scripts/r2-setup.ts` does both).
5. Resend: add domain `sundaytomonday.church`, publish the DNS records (DKIM, SPF, MX for receiving), create an inbound webhook pointing at `https://<app>/api/inbound/resend` for `email.received`, put its signing secret in `RESEND_INBOUND_WEBHOOK_SECRET`.
6. Vercel: create project from the GitHub repo, framework Next.js, set env vars, deploy. `vercel.json` schedules the 48-hour maintenance cron (`/api/cron/maintenance`, guarded by `CRON_SECRET`).
7. Smoke test on the public URL: PIN → dashboard → upload run sheet → merge → export JPG + MP4; admin sign-in with password and magic link.

## Retention
Temporary objects (run sheets, exports, tmp) expire from R2 after `temporary_retention_days` (default 60) via bucket lifecycle rules. Templates, assets and fonts never expire. Metadata stays in Supabase.

## Sunday PIN
Stored hashed (bcrypt). Changing it in Admin → Settings bumps `sunday_pin_version`, which invalidates every Sunday session cookie.
