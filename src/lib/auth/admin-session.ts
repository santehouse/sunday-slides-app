import "server-only";
/**
 * Admin session: a real Supabase Auth session (email/password or magic
 * link) joined to the `admin_users` row it belongs to. In mock mode
 * (`isMockMode()`), Supabase Auth doesn't exist — a `cp_mock_admin=1`
 * cookie set by `signInWithPassword`/magic-link stands in for it so every
 * Admin screen still works without a Supabase project.
 */
import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { isMockMode, isProduction } from "@/lib/env";
import { getDb } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AdminUser, Locale } from "@/lib/domain/types";

export const MOCK_ADMIN_COOKIE = "cp_mock_admin";
/** authUserId used for the seeded mock admin (see mockSeed.ts / mockDb.ts). */
const MOCK_ADMIN_AUTH_ID = "mock-auth-josiah";
const MOCK_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface AdminSession {
  authUser: { id: string; email: string };
  adminUser: AdminUser;
}

export type SignInResult = { ok: true } | { ok: false; error: "invalid_credentials" };
export type MagicLinkResult = { ok: true; mock?: boolean } | { ok: false; error: string };

/** Returns the current admin session, or null if signed out, unknown, or disabled. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const db = getDb();

  if (isMockMode()) {
    const cookieStore = await cookies();
    if (cookieStore.get(MOCK_ADMIN_COOKIE)?.value !== "1") return null;
    const adminUser = await db.getAdminUserByAuthId(MOCK_ADMIN_AUTH_ID);
    if (!adminUser || adminUser.disabledAt) return null;
    return { authUser: { id: MOCK_ADMIN_AUTH_ID, email: adminUser.email }, adminUser };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const adminUser = await db.getAdminUserByAuthId(user.id);
  if (!adminUser || adminUser.disabledAt) return null;
  return { authUser: { id: user.id, email: user.email ?? adminUser.email }, adminUser };
}

/** For the `admin` layout: redirects (locale-aware) to sign-in when there's no valid admin session. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (session) return session;
  const locale = await getLocale();
  return redirect({ href: "/admin/sign-in", locale });
}

export async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
  if (isMockMode()) {
    // Any email/password combination works in mock mode so screens are reachable without Supabase.
    const cookieStore = await cookies();
    cookieStore.set(MOCK_ADMIN_COOKIE, "1", {
      httpOnly: true,
      secure: isProduction(),
      sameSite: "lax",
      path: "/",
      maxAge: MOCK_SESSION_MAX_AGE,
    });
    return { ok: true };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: "invalid_credentials" };
  return { ok: true };
}

export async function sendMagicLink(email: string, redirectTo: string): Promise<MagicLinkResult> {
  if (isMockMode()) {
    // No real email is sent in mock mode; the sign-in form explains that instead of
    // claiming a link is on its way.
    return { ok: true, mock: true };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  if (isMockMode()) {
    const cookieStore = await cookies();
    cookieStore.delete(MOCK_ADMIN_COOKIE);
    return;
  }
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}

/** Persists the current admin's locale preference (`admin_users.locale`) so it follows them to another device. */
export async function updateCurrentAdminLocale(locale: Locale): Promise<void> {
  const session = await getAdminSession();
  if (!session) return;
  await getDb().updateAdminUserLocale(session.adminUser.id, locale);
}
