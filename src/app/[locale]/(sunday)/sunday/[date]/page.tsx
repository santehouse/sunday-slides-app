import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Upload } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/lib/data";
import { buildColorHexById, buildTemplatesById, collectBackgroundAssetIds, resolveAssetsByIds } from "@/lib/sunday/view";
import type { RunSheetParseStatus } from "@/lib/domain/types";
import type { StatusBadgeStatus } from "@/components/ui/StatusBadge";
import { SundayShell } from "@/components/shell/SundayShell";
import { SundayPageHeader } from "@/components/shell/SundayPageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SundayWeekSwitcher } from "@/components/sunday/SundayWeekSwitcher";
import { SlidePreview } from "@/components/sunday/SlidePreview";
import { HoldSecondsCard } from "./HoldSecondsCard";

const RUN_SHEET_STATUS_BADGE: Record<RunSheetParseStatus, StatusBadgeStatus> = {
  queued: "queued",
  processing: "processing",
  ready_to_apply: "apply",
  added_to_flow: "added",
  needs_review: "needsReview",
  failed: "failed",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; date: string }>;
}): Promise<Metadata> {
  const { locale, date } = await params;
  const t = await getTranslations({ locale, namespace: "sunday.dashboard" });
  return { title: t("title", { date: new Date(`${date}T00:00:00`) }) };
}

export default async function SundayDashboardPage({
  params,
}: {
  params: Promise<{ locale: string; date: string }>;
}) {
  const { locale, date } = await params;
  setRequestLocale(locale);

  const db = getDb();
  const sunday = await db.getSundayByDate(date);
  if (!sunday) notFound();

  const [slides, runSheet, adjacent, templates, colors] = await Promise.all([
    db.listSlidesForSunday(sunday.id),
    db.getLatestRunSheetForSunday(sunday.id),
    db.getAdjacentSundayDates(date),
    db.listTemplates(),
    db.listApprovedColors(),
  ]);

  const templatesMap = buildTemplatesById(templates);
  const colorMap = buildColorHexById(colors);
  const assets = await resolveAssetsByIds(collectBackgroundAssetIds(slides, templatesMap));

  const t = await getTranslations("sunday.dashboard");

  const slidesPrepared = slides.length;
  const needsReview = slides.filter((s) => s.status === "needs_review").length;
  const includedInMp4 = slides.filter((s) => s.includeInVideo).length;

  const announcements = runSheet?.parsedJson?.sections.flatMap((section) => section.announcements) ?? [];
  const reviewCount = announcements.filter((a) => a.reviewReasons.length > 0).length;
  const matchedCount = Math.max(0, announcements.length - reviewCount);

  const subtitle = runSheet
    ? t("subtitleFromFile", { file: runSheet.originalFilename })
    : t("subtitleNoRunSheet");

  return (
    <SundayShell>
      <SundayPageHeader
        titleSize="xl"
        title={t("title", { date: new Date(`${date}T00:00:00`) })}
        subtitle={subtitle}
        actions={<SundayWeekSwitcher date={date} prevDate={adjacent.prev} nextDate={adjacent.next} size="md" />}
      />

      <div className="grid grid-cols-4 gap-3.5">
        <StatCard value={slidesPrepared} label={t("slidesPrepared")} />
        <StatCard value={needsReview} label={t("needsReview")} />
        <StatCard value={includedInMp4} label={t("includedInMp4")} />
        <HoldSecondsCard sundayId={sunday.id} initialSeconds={sunday.defaultSlideHoldSeconds} />
      </div>

      <div className="grid grid-cols-[1fr_424px] gap-3.5">
        <Card padding="md" className="flex flex-col gap-4">
          <CardHeader
            title={t("sundayFlow")}
            action={
              <Button variant="secondary" href={`/sunday/${date}/flow`}>
                {t("openFlow")}
              </Button>
            }
          />
          {slides.length === 0 ? (
            <p className="text-label text-fg-secondary">{t("emptyFlow")}</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {slides.map((slide, index) => {
                const template = templatesMap[slide.templateId];
                if (!template) return null;
                return (
                  <div key={slide.id} className="flex h-[68px] items-center gap-3 rounded-[10px] bg-surface-subtle px-3">
                    <span className="w-6 shrink-0 text-caption font-bold text-fg-secondary">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="h-[45px] w-20 shrink-0 overflow-hidden rounded-[6px] border border-border">
                      <SlidePreview
                        template={template}
                        slide={slide}
                        backgroundColorHex={slide.approvedColorId ? (colorMap[slide.approvedColorId] ?? null) : null}
                        assets={assets}
                      />
                    </div>
                    <p className="flex-1 truncate text-label text-fg">{slide.headline}</p>
                    <StatusBadge
                      status={slide.status === "needs_review" ? "needsReview" : slide.status === "invalid" ? "invalid" : "ready"}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card padding="md" className="flex flex-col gap-4">
          <h2 className="text-h3 font-bold text-fg">{t("runSheet")}</h2>
          {runSheet ? (
            <>
              <div className="flex flex-col gap-1">
                <p className="text-label font-bold text-fg">{runSheet.originalFilename}</p>
                <p className="text-caption text-fg-secondary">
                  {runSheet.sourceType === "email" ? t("receivedByEmail") : t("uploadedManually")}
                </p>
              </div>
              <p className="text-[13px] text-fg-secondary">
                {t("runSheetSummary", { matched: matchedCount, review: reviewCount })}
              </p>
              <StatusBadge status={RUN_SHEET_STATUS_BADGE[runSheet.parseStatus]} />
              <Button variant="secondary" leadingIcon={Upload} href={`/sunday/${date}/upload`}>
                {t("replaceRunSheet")}
              </Button>
            </>
          ) : (
            <>
              <StatusBadge status="waiting" />
              <p className="text-label text-fg-secondary">{t("noRunSheet")}</p>
              <Button variant="primary" href={`/sunday/${date}/upload`}>
                {t("uploadRunSheet")}
              </Button>
            </>
          )}
        </Card>
      </div>
    </SundayShell>
  );
}
