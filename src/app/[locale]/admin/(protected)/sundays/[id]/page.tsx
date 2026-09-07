import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { getDb } from "@/lib/data";
import { serviceDateToDate } from "@/lib/utils/serviceDate";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusBadge, type StatusBadgeStatus } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { RunSheetRow } from "./RunSheetRow";

const SUNDAY_STATUS_MAP: Record<string, StatusBadgeStatus> = {
  draft: "draft",
  needs_review: "needsReview",
  ready: "ready",
  exported: "exported",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const db = getDb();
  const sunday = await db.getSundayById(id);
  const t = await getTranslations({ locale, namespace: "admin.sundays" });
  return { title: sunday ? `${sunday.serviceDate} · ${t("title")}` : t("title") };
}

export default async function SundayDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "admin.sundays" });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const format = await getFormatter({ locale });

  const db = getDb();
  const sunday = await db.getSundayById(id);
  if (!sunday) notFound();

  const [runSheets, slides] = await Promise.all([
    db.listRunSheetsForSunday(sunday.id),
    db.listSlidesForSunday(sunday.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-h1 font-bold text-fg">
            {format.dateTime(serviceDateToDate(sunday.serviceDate), "dateMedium")}
          </h1>
          <StatusBadge status={SUNDAY_STATUS_MAP[sunday.status] ?? "draft"} />
        </div>
        <Button variant="secondary" href="/sunday">
          {t("openSunday")}
        </Button>
      </div>

      <p className="text-label text-fg-secondary">{tCommon("slidesCount", { count: slides.length })}</p>

      <Card className="flex flex-col gap-4">
        <CardHeader title={t("runSheets")} />
        {runSheets.length === 0 ? (
          <p className="text-label text-fg-secondary">{t("noRunSheets")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {runSheets.map((runSheet) => (
              <RunSheetRow key={runSheet.id} runSheet={runSheet} />
            ))}
          </div>
        )}
      </Card>

      <div>
        <Link
          href="/admin/sundays"
          className="inline-flex items-center gap-2 text-label text-fg-secondary hover:underline"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          {t("title")}
        </Link>
      </div>
    </div>
  );
}
