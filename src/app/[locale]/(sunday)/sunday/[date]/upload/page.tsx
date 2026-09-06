import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/lib/data";
import { serviceDateToDate } from "@/lib/utils/serviceDate";
import { SundayShell } from "@/components/shell/SundayShell";
import { SundayPageHeader } from "@/components/shell/SundayPageHeader";
import { SundayTabs } from "@/components/sunday/SundayTabs";
import { SundayWeekSwitcher } from "@/components/sunday/SundayWeekSwitcher";
import { UploadClient } from "./UploadClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sunday.upload" });
  return { title: t("title") };
}

export default async function UploadRunSheetPage({
  params,
}: {
  params: Promise<{ locale: string; date: string }>;
}) {
  const { locale, date } = await params;
  setRequestLocale(locale);

  const db = getDb();
  const sunday = await db.getSundayByDate(date);
  if (!sunday) notFound();

  const [slides, currentRunSheet, adjacent] = await Promise.all([
    db.listSlidesForSunday(sunday.id),
    db.getLatestRunSheetForSunday(sunday.id),
    db.getAdjacentSundayDates(date),
  ]);

  const needsReviewCount = slides.filter((s) => s.status === "needs_review").length;

  const t = await getTranslations("sunday.upload");
  const tDashboard = await getTranslations("sunday.dashboard");

  return (
    <SundayShell>
      <SundayPageHeader
        titleSize="xl"
        title={tDashboard("title", { date: serviceDateToDate(date) })}
        subtitle={t("subtitle")}
        actions={<SundayWeekSwitcher date={date} prevDate={adjacent.prev} nextDate={adjacent.next} size="md" />}
      />

      <SundayTabs date={date} needsReviewCount={needsReviewCount} />

      <UploadClient date={date} hasSlides={slides.length > 0} currentRunSheet={currentRunSheet} />
    </SundayShell>
  );
}
