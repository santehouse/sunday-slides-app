import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/lib/data";
import { serviceDateToDate, todayInTimezone } from "@/lib/utils/serviceDate";
import { hasOpenAI, hasR2, hasResend, hasSupabase, isMockMode } from "@/lib/env";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { CreateSundayDialog } from "@/components/admin/CreateSundayDialog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.dashboard" });
  return { title: t("title") };
}

type Tone = "success" | "warning" | "error" | "info" | "subtle";

// Figma 7:326 renders System health values as bold coloured *text*, not badge pills.
// The wording ("Connected", "Ready", …) carries the meaning; colour only reinforces it.
const TONE_CLASSES: Record<Tone, string> = {
  success: "text-success-fg",
  warning: "text-warning-fg",
  error: "text-error-fg",
  info: "text-info-fg",
  subtle: "text-fg-secondary",
};

function HealthValue({ label, tone }: { label: string; tone: Tone }) {
  return <span className={`whitespace-nowrap text-label font-bold ${TONE_CLASSES[tone]}`}>{label}</span>;
}

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "admin.dashboard" });
  const format = await getFormatter({ locale });
  const isFr = locale.startsWith("fr");

  const db = getDb();
  // "Today" in the church timezone, not the server's (see lib/utils/serviceDate).
  const todayIso = todayInTimezone(process.env.APP_TIMEZONE ?? "America/Toronto");

  const [nextSunday, sundays, publishedTemplates, publishedAssets, mappings, structuralDefaults, settings, systemChecks] =
    await Promise.all([
      db.getNextSunday(todayIso, { create: false }),
      db.listSundays({ limit: 20 }),
      db.listTemplates({ status: "published" }),
      db.listAssets({ status: "published" }),
      db.listMappings(),
      db.listStructuralDefaults({ enabledOnly: true }),
      db.getSettings(),
      db.latestSystemChecks(),
    ]);

  const upcoming = nextSunday ? sundays.find((s) => s.id === nextSunday.id) ?? null : null;
  const structuralNames = structuralDefaults
    .map((d) => (isFr ? d.nameFr : d.nameEn))
    .join(" · ");

  function checkStatus(type: string): "ok" | "warn" | "error" | null {
    return systemChecks.find((c) => c.checkType === type)?.status ?? null;
  }

  const inboundOk = hasResend() && Boolean(settings.inboundEmail);
  const maintenanceCheck = checkStatus("maintenance");

  const healthRows: { key: string; label: string; value: string; tone: Tone }[] = [
    {
      key: "inboundEmail",
      label: t("health.inboundEmail"),
      value: inboundOk ? t("health.connected") : t("health.notConfigured"),
      tone: inboundOk ? "success" : "warning",
    },
    {
      key: "openai",
      label: t("health.openai"),
      value: hasOpenAI() ? t("health.ready") : t("health.notConfigured"),
      tone: hasOpenAI() ? "success" : "warning",
    },
    {
      key: "r2",
      label: t("health.r2"),
      value: hasR2() ? t("health.healthy") : isMockMode() ? t("health.healthy") : t("health.notConfigured"),
      tone: hasR2() || isMockMode() ? "success" : "warning",
    },
    {
      key: "supabase",
      label: t("health.supabase"),
      value: hasSupabase() ? t("health.active") : isMockMode() ? t("health.active") : t("health.notConfigured"),
      tone: hasSupabase() || isMockMode() ? "success" : "warning",
    },
    {
      key: "maintenance",
      label: t("health.maintenance"),
      value:
        maintenanceCheck === "error"
          ? t("health.error")
          : maintenanceCheck === "warn"
            ? t("health.notConfigured")
            : t("health.scheduled"),
      tone: maintenanceCheck === "error" ? "error" : "info",
    },
  ];

  const includedInVideo = upcoming?.slideCounts.includedInVideo ?? 0;
  const videoSeconds = includedInVideo * (upcoming?.defaultSlideHoldSeconds ?? settings.defaultSlideHoldSeconds);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-bold text-fg">{t("title")}</h1>
          <p className="mt-1.5 text-caption text-fg-secondary">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" href="/admin/sundays?upload=1">
            {t("uploadRunSheet")}
          </Button>
          <CreateSundayDialog />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          className="h-[120px]"
          value={upcoming ? format.dateTime(serviceDateToDate(upcoming.serviceDate), "sundayShort") : "—"}
          label={t("nextService")}
        />
        <StatCard className="h-[120px]" value={publishedTemplates.length} label={t("publishedTemplates")} />
        <StatCard className="h-[120px]" value={publishedAssets.length} label={t("publishedAssets")} />
        <StatCard className="h-[120px]" value={mappings.length} label={t("mappings")} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_376px]">
        <Card className="flex flex-col gap-5">
          <CardHeader title={t("upcomingSunday")} />
          {upcoming ? (
            <>
              <p className="text-caption text-fg-secondary">
                {upcoming.latestRunSheet
                  ? t("upcomingSubtitle", {
                      date: serviceDateToDate(upcoming.serviceDate),
                      file: upcoming.latestRunSheet.originalFilename,
                    })
                  : t("upcomingSubtitleNoFile", { date: serviceDateToDate(upcoming.serviceDate) })}
              </p>
              <div className="flex flex-col gap-2.5">
                <div className="flex h-[58px] items-center justify-between rounded-[10px] bg-surface-subtle px-3.5">
                  <span className="text-label font-bold text-fg">{t("runSheet")}</span>
                  {upcoming.latestRunSheet ? (
                    <StatusBadge
                      status={
                        upcoming.latestRunSheet.parseStatus === "added_to_flow"
                          ? "added"
                          : upcoming.latestRunSheet.parseStatus === "ready_to_apply"
                            ? "apply"
                            : upcoming.latestRunSheet.parseStatus === "needs_review"
                              ? "needsReview"
                              : upcoming.latestRunSheet.parseStatus === "failed"
                                ? "failed"
                                : "processing"
                      }
                    />
                  ) : (
                    <StatusBadge status="waiting" />
                  )}
                </div>
                <div className="flex h-[58px] items-center justify-between rounded-[10px] bg-surface-subtle px-3.5">
                  <span className="text-label font-bold text-fg">{t("slides")}</span>
                  <span className="text-label font-bold text-fg">
                    {t("slidesValue", {
                      prepared: upcoming.slideCounts.total,
                      review: upcoming.slideCounts.needsReview,
                    })}
                  </span>
                </div>
                <div className="flex h-[58px] items-center justify-between rounded-[10px] bg-surface-subtle px-3.5">
                  <span className="text-label font-bold text-fg">{t("videoLoop")}</span>
                  <span className="text-label font-bold text-fg">
                    {t("videoLoopValue", { included: includedInVideo, seconds: videoSeconds })}
                  </span>
                </div>
                <div className="flex min-h-[58px] items-center justify-between gap-4 rounded-[10px] bg-surface-subtle px-3.5 py-3">
                  <span className="shrink-0 text-label font-bold text-fg">{t("structuralDefaults")}</span>
                  <span className="text-right text-label text-fg-secondary">{structuralNames || "—"}</span>
                </div>
              </div>
              <div>
                <Button variant="primary" href={`/sunday/${upcoming.serviceDate}/flow`}>
                  {t("openSundayFlow")}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-label text-fg-secondary">{t("noUpcomingSunday")}</p>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <CardHeader title={t("systemHealth")} />
          <div className="flex flex-col">
            {healthRows.map((row) => (
              <div key={row.key} className="flex h-[58px] items-center justify-between gap-4">
                <span className="text-label text-fg">{row.label}</span>
                <HealthValue label={row.value} tone={row.tone} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
