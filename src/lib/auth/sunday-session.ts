import "server-only";
/**
 * Sunday-team PIN session. The Sunday team is never a Supabase user — a
 * correct PIN gets a signed, httpOnly cookie (`cp_sunday`) containing the
 * settings' `sundayPinVersion`. Rotating the PIN (`setSundayPin`) bumps that
 * version, which silently invalidates every existing cookie on next check.
 */
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { compare } from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { redirect } from "@/i18n/navigation";
import { env, isProduction } from "@/lib/env";
import { getDb } from "@/lib/data";

export const SUNDAY_SESSION_COOKIE = "cp_sunday";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days
const PIN_RATE_LIMIT_MAX_FAILURES = 5;
const PIN_RATE_LIMIT_WINDOW_MINUTES = 10;
/** Only ever used outside production — a real deployment must set SUNDAY_SESSION_SECRET. */
const DEV_FALLBACK_SECRET = "church-panels-dev-only-sunday-session-secret";

export type PinErrorCode = "invalid" | "rate_limited" | "not_configured";

export class PinError extends Error {
  constructor(public readonly code: PinErrorCode) {
    super(`Sunday PIN error: ${code}`);
    this.name = "PinError";
  }
}

export interface SundaySession {
  pinVersion: number;
}

function getSecretKey(): Uint8Array {
  const secret = env.SUNDAY_SESSION_SECRET || (!isProduction() ? DEV_FALLBACK_SECRET : undefined);
  if (!secret) {
    throw new Error("SUNDAY_SESSION_SECRET is required in production.");
  }
  return new TextEncoder().encode(secret);
}

/** Stable, non-reversible key for rate limiting — never store the raw IP. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

/**
 * Verifies the PIN (with rate limiting) and, on success, sets the session
 * cookie. Throws `PinError` on any failure — callers (the `submitPin`
 * server action) translate `error.code` into a MessageState.
 */
export async function verifyPinAndCreateSession(pin: string, ip: string): Promise<SundaySession> {
  const db = getDb();
  const ipHash = hashIp(ip);

  const recentFailures = await db.countRecentPinFailures(ipHash, PIN_RATE_LIMIT_WINDOW_MINUTES);
  if (recentFailures >= PIN_RATE_LIMIT_MAX_FAILURES) {
    throw new PinError("rate_limited");
  }

  const settings = await db.getSettings();
  if (!settings.sundayPinHash) {
    throw new PinError("not_configured");
  }

  const ok = await compare(pin, settings.sundayPinHash);
  await db.recordPinAttempt(ipHash, ok);
  if (!ok) {
    throw new PinError("invalid");
  }

  const jwt = await new SignJWT({ v: settings.sundayPinVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(SUNDAY_SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return { pinVersion: settings.sundayPinVersion };
}

/** Reads + validates the Sunday session cookie. Returns null if missing, expired, tampered, or PIN-rotated. */
export async function getSundaySession(): Promise<SundaySession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SUNDAY_SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const version = payload.v;
    if (typeof version !== "number") return null;

    const settings = await getDb().getSettings();
    if (version !== settings.sundayPinVersion) return null;

    return { pinVersion: version };
  } catch {
    return null;
  }
}

/** For the `(sunday)` layout: redirects (locale-aware) to the PIN page when there's no valid session. */
export async function requireSundaySession(): Promise<SundaySession> {
  const session = await getSundaySession();
  if (session) return session;
  const locale = await getLocale();
  return redirect({ href: "/sunday/pin", locale });
}

export async function clearSundaySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SUNDAY_SESSION_COOKIE);
}
