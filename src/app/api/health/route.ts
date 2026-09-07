import { NextResponse } from "next/server";
import { hasOpenAI, hasR2, hasResend, hasSupabase, isMockMode } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Lightweight health/status endpoint: which integrations are configured (booleans
 * only — never a secret value) plus the most recent `system_checks` rows written by
 * the scheduled maintenance job (section 33). No auth — nothing here is sensitive.
 *
 * The data layer is imported lazily inside a try/catch so this endpoint can still
 * report a broken deployment (module-init failures included) instead of crashing.
 */
export async function GET(): Promise<NextResponse> {
  let dbOk = false;
  let dbError: string | null = null;
  let systemChecks: unknown[] = [];

  try {
    const { getDb } = await import("@/lib/data");
    const db = getDb();
    await db.getSettings();
    dbOk = true;
    try {
      systemChecks = await db.latestSystemChecks();
    } catch {
      systemChecks = [];
    }
  } catch (error) {
    dbError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }

  return NextResponse.json(
    {
      ok: dbOk,
      mockMode: isMockMode(),
      integrations: {
        supabase: hasSupabase(),
        r2: hasR2(),
        resend: hasResend(),
        openai: hasOpenAI(),
      },
      systemChecks,
      ...(dbError ? { error: dbError } : {}),
    },
    { status: dbOk ? 200 : 503 },
  );
}
