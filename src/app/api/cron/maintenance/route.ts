import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/data";
import { env, hasOpenAI, hasR2, hasResend, hasSupabase, isMockMode } from "@/lib/env";
import type { SystemCheck } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Scheduled maintenance (see vercel.json / docs/OPERATIONS.md, every 48h):
 *  - ensures the next upcoming Sunday record exists
 *  - checks whether it already has a run sheet
 *  - counts failed run sheets / export jobs in the last 7 days
 *  - records one `system_checks` row per integration + one `maintenance` rollup
 *
 * Guarded by `Authorization: Bearer ${CRON_SECRET}` — never trust an
 * unauthenticated caller to trigger this.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getDb();

  let supabaseStatus: SystemCheck["status"] = hasSupabase() || isMockMode() ? "ok" : "warn";
  try {
    await db.getSettings();
  } catch {
    supabaseStatus = "error";
  }
  await db.recordSystemCheck("supabase", supabaseStatus, { mockMode: isMockMode(), configured: hasSupabase() });
  await db.recordSystemCheck("r2", hasR2() ? "ok" : "warn", { configured: hasR2() });
  await db.recordSystemCheck("openai", hasOpenAI() ? "ok" : "warn", { configured: hasOpenAI() });
  await db.recordSystemCheck("resend", hasResend() ? "ok" : "warn", { configured: hasResend() });

  const today = new Date().toISOString().slice(0, 10);
  const nextSunday = await db.getNextSunday(today, { create: true });
  const nextSundayRunSheet = nextSunday ? await db.getLatestRunSheetForSunday(nextSunday.id) : null;

  const cutoff = Date.now() - SEVEN_DAYS_MS;
  const recentSundays = await db.listSundays({ limit: 20 });
  let failedRunSheets = 0;
  for (const sunday of recentSundays) {
    const sheets = await db.listRunSheetsForSunday(sunday.id);
    failedRunSheets += sheets.filter(
      (sheet) => sheet.parseStatus === "failed" && new Date(sheet.receivedAt).getTime() >= cutoff,
    ).length;
  }
  const recentExportJobs = await db.listRecentExportJobs(50);
  const failedExportJobs = recentExportJobs.filter(
    (job) => job.status === "failed" && new Date(job.createdAt).getTime() >= cutoff,
  ).length;

  const details = {
    nextSundayDate: nextSunday?.serviceDate ?? null,
    nextSundayHasRunSheet: Boolean(nextSundayRunSheet),
    failedRunSheetsLast7Days: failedRunSheets,
    failedExportJobsLast7Days: failedExportJobs,
  };
  const maintenanceStatus: SystemCheck["status"] =
    supabaseStatus === "error" ? "error" : failedRunSheets > 0 || failedExportJobs > 0 ? "warn" : "ok";
  await db.recordSystemCheck("maintenance", maintenanceStatus, details);

  return NextResponse.json({
    ok: true,
    ...details,
    integrations: {
      supabase: supabaseStatus,
      r2: hasR2() ? "ok" : "warn",
      openai: hasOpenAI() ? "ok" : "warn",
      resend: hasResend() ? "ok" : "warn",
    },
  });
}
