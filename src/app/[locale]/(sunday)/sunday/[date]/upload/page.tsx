import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/lib/data";
import { SundayShell } from "@/components/shell/SundayShell";
import { SundayPageHeader } from "@/components/shell/SundayPageHeader";
import { Button } from "@/components/ui/Button";
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

  const [slides, currentRunSheet] = await Promise.all([
    db.listSlidesForSunday(sunday.id),
    db.getLatestRunSheetForSunday(sunday.id),
  ]);

  const t = await getTranslations("sunday.upload");
  const tCommon = await getTranslations("common");

  return (
    <SundayShell>
      <SundayPageHeader
        titleSize="lg"
        title={t("title")}
        backHref={`/sunday/${date}/flow`}
        actions={
          <Button variant="secondary" href={`/sunday/${date}/flow`}>
            {tCommon("cancel")}
          </Button>
        }
      />
      <UploadClient date={date} hasSlides={slides.length > 0} currentRunSheet={currentRunSheet} />
    </SundayShell>
  );
}
