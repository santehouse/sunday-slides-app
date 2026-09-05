import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/lib/data";
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

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-success-bg text-success-fg",
  warning: "bg-warning-bg text-warning-fg",
  error: "bg-error-bg text-error-fg",
  info: "bg-info-bg text-info-fg",
  subtle: "bg-surface-subtle text-fg-secondary",
};

function HealthChip({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-caption font-bold ${TONE_CLASSES[tone]}`}>
      {label}
    </span>
  );
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
  const todayIso = new Date().toISOString().slice(0, 10);

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
          value={upcoming ? format.dateTime(new Date(`${upcoming.serviceDate}T00:00:00`), "dateMedium") : "—"}
          label={t("nextService")}
        />
        <StatCard value={publishedTemplates.length} label={t("publishedTemplates")} />
        <StatCard value={publishedAssets.length} label={t("publishedAssets")} />
        <StatCard value={mappings.length} label={t("mappings")} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_376px]">
        <Card className="flex flex-col gap-5">
          <CardHeader title={t("upcomingSunday")} />
          {upcoming ? (
            <>
              <p className="text-caption text-fg-secondary">
                {upcoming.latestRunSheet
                  ? t("upcomingSubtitle", {
                      date: new Date(`${upcoming.serviceDate}T00:00:00`),
                      file: upcoming.latestRunSheet.originalFilename,
                    })
                  : t("upcomingSubtitleNoFile", { date: new Date(`${upcoming.serviceDate}T00:00:00`) })}
              </p>
              <div className="flex flex-col divide-y divide-border">
                <div className="flex h-[58px] items-center justify-between">
                  <span className="text-label text-fg-secondary">{t("runSheet")}</span>
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
                <div className="flex h-[58px] items-center justify-between">
                  <span className="text-label text-fg-secondary">{t("slides")}</span>
                  <span className="text-label font-bold text-fg">
                    {t("slidesValue", {
                      prepared: upcoming.slideCounts.total,
                      review: upcoming.slideCounts.needsReview,
                    })}
                  </span>
                </div>
                <div className="flex h-[58px] items-center justify-between">
                  <span className="text-label text-fg-secondary">{t("videoLoop")}</span>
                  <span className="text-label font-bold text-fg">
                    {t("videoLoopValue", { included: includedInVideo, seconds: videoSeconds })}
                  </span>
                </div>
                <div className="flex min-h-[58px] items-center justify-between gap-4 py-3">
                  <span className="shrink-0 text-label text-fg-secondary">{t("structuralDefaults")}</span>
                  <span className="text-right text-label font-bold text-fg">{structuralNames || "—"}</span>
                </div>
              </div>
              <div>
                <Button variant="secondary" href={`/sunday/${upcoming.serviceDate}/flow`}>
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
          <div className="flex flex-col divide-y divide-border">
            {healthRows.map((row) => (
              <div key={row.key} className="flex h-11 items-center justify-between">
                <span className="text-label text-fg-secondary">{row.label}</span>
                <HealthChip label={row.value} tone={row.tone} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
