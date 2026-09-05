import "server-only";
import { z } from "zod";

/**
 * Typed, server-only environment access. Never throws at import time — every
 * consumer either checks `hasX()` first or gets a clear runtime error only
 * when it actually tries to use a missing credential.
 *
 * `CP_MOCK_DATA=1` (or missing Supabase config) puts the whole app in mock
 * mode: `getDb()` returns the in-memory store and auth helpers accept a mock
 * admin cookie instead of a real Supabase session.
 */

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_URL: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  APP_TIMEZONE: z.string().default("America/Toronto"),
  CRON_SECRET: z.string().optional(),
  SUNDAY_SESSION_SECRET: z.string().optional(),
  CP_MOCK_DATA: z.string().optional(),

  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_ENDPOINT: z.string().optional(),
  R2_PUBLIC_BASE_URL: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  RESEND_INBOUND_WEBHOOK_SECRET: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  RUN_SHEET_INBOUND_EMAIL: z.string().optional(),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4.1"),

  SEED_ADMIN_EMAIL: z.string().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
  SEED_SUNDAY_PIN: z.string().optional(),
});

type RawEnv = z.infer<typeof schema>;

/** Parsed lazily so a bad/missing var never throws during module import (route collection, build, etc). */
let cached: RawEnv | null = null;

function raw(): RawEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  // Config should never be strict enough to crash the process at import time —
  // fall back to defaults-only so `hasX()` checks still work and report false.
  cached = parsed.success ? parsed.data : schema.parse({});
  return cached;
}

export const env = new Proxy({} as RawEnv, {
  get(_target, prop: string) {
    return raw()[prop as keyof RawEnv];
  },
}) as RawEnv;

export function hasSupabase(): boolean {
  const e = raw();
  return Boolean(e.NEXT_PUBLIC_SUPABASE_URL && e.NEXT_PUBLIC_SUPABASE_ANON_KEY && e.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasR2(): boolean {
  const e = raw();
  return Boolean(e.R2_ACCOUNT_ID && e.R2_ACCESS_KEY_ID && e.R2_SECRET_ACCESS_KEY && e.R2_BUCKET);
}

export function hasResend(): boolean {
  return Boolean(raw().RESEND_API_KEY);
}

export function hasOpenAI(): boolean {
  return Boolean(raw().OPENAI_API_KEY);
}

/** Mock mode: explicit opt-in, or an automatic fallback when Supabase isn't configured. */
export function isMockMode(): boolean {
  return raw().CP_MOCK_DATA === "1" || !hasSupabase();
}

export function isProduction(): boolean {
  return raw().NODE_ENV === "production";
}

export function appUrl(): string {
  const e = raw();
  return e.APP_URL ?? e.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
