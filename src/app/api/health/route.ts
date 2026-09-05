import { NextResponse } from "next/server";
import { getDb } from "@/lib/data";
import { hasOpenAI, hasR2, hasResend, hasSupabase, isMockMode } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Lightweight health/status endpoint: which integrations are configured (booleans
 * only — never a secret value) plus the most recent `system_checks` rows written by
 * the scheduled maintenance job (section 33). No auth — nothing here is sensitive.
 */
export async function GET(): Promise<NextResponse> {
  const db = getDb();

  let dbOk = true;
  try {
    await db.getSettings();
  } catch {
    dbOk = false;
  }

  let systemChecks: Awaited<ReturnType<typeof db.latestSystemChecks>> = [];
  try {
    systemChecks = await db.latestSystemChecks();
  } catch {
    systemChecks = [];
  }

  return NextResponse.json({
    ok: dbOk,
    mockMode: isMockMode(),
    integrations: {
      supabase: hasSupabase(),
      r2: hasR2(),
      resend: hasResend(),
      openai: hasOpenAI(),
    },
    systemChecks,
  });
}
