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

## Migrations pending on production
- `0002_run_sheet_opened_at.sql` (Import modal "new" dot)
- `0003_template_field_layers.sql` (image fields, default text, rotated/boxed labels) — then run `scripts/apply-brand-templates.ts` (see docs/HANDOFF.md).

## Picture uploads go straight to R2
Assets and slide pictures are uploaded by the browser to a signed R2 PUT URL (Server Actions
only carry metadata; their body cap is 4 MB). The bucket needs a CORS rule for every app
origin — `node scripts/r2-cors.mjs` sets it (production, staging, localhost). Without R2
(local/mock) the dialogs fall back to the 4 MB Server Action path.

## Admin magic-link email (Supabase Auth → Resend SMTP)

Supabase's built-in mailer only delivers to project members and is capped at 2 emails/hour, so the
production project sends Auth email through Resend's SMTP relay instead (configured via the
Management API, `PATCH /v1/projects/{ref}/config/auth`):

| Setting | Value |
|---|---|
| `smtp_host` / `smtp_port` | `smtp.resend.com` / `465` |
| `smtp_user` / `smtp_pass` | `resend` / the Resend API key (full access) |
| `smtp_admin_email` | `no-reply@eajc.sundaytomonday.church` (verified Resend domain) |
| `smtp_sender_name` | `Church Panels` |
| `rate_limit_email_sent` | `30` per hour |

The link lands on `/api/auth/callback`, which exchanges the code for a session and redirects to
`/admin`. `site_url` and `uri_allow_list` must include the environment's domain. Rotating the Resend
key means re-applying `smtp_pass`. Staging (mock mode) never sends email — the sign-in form says so.

## Sunday PIN
Stored hashed (bcrypt). Changing it in Admin → Settings bumps `sunday_pin_version`, which invalidates every Sunday session cookie.

## Scheduled maintenance (`/api/cron/maintenance`)
`vercel.json` fires `GET /api/cron/maintenance` every 48 hours (`0 6 */2 * *`, guarded by `Authorization: Bearer ${CRON_SECRET}` — Vercel Cron sends this automatically when `CRON_SECRET` is set on the project). Each run:
- ensures the next upcoming Sunday record exists (creating it if needed),
- checks whether that Sunday already has a run sheet,
- counts failed run sheets and export jobs in the last 7 days,
- writes one `system_checks` row per integration (`supabase`, `r2`, `openai`, `resend`, from env presence + a trivial DB round trip) plus a `maintenance` rollup (`ok`/`warn`/`error`).

The Admin dashboard's "System health" panel reads `latestSystemChecks()` (one row per `check_type`) to show integration status. A missing/unavailable third-party service degrades that panel only — it never blocks the Sunday or Admin UI.
