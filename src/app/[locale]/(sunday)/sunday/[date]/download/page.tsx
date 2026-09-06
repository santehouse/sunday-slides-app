import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/lib/data";
import { isSundayDate } from "@/lib/utils/serviceDate";
import { buildColorHexById, buildSundayStepperData, buildTemplatesById, collectBackgroundAssetIds, resolveAssetsByIds } from "@/lib/sunday/view";
import { SundayShell } from "@/components/shell/SundayShell";
import { SundayStepper } from "@/components/sunday/SundayStepper";
import { DownloadClient } from "@/components/sunday/DownloadClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sunday.simple.stepper" });
  return { title: t("step3Label") };
}

export default async function DownloadPage({
  params,
}: {
  params: Promise<{ locale: string; date: string }>;
}) {
  const { locale, date } = await params;
  setRequestLocale(locale);

  const db = getDb();
  if (!isSundayDate(date)) notFound();
  const sunday = (await db.getSundayByDate(date)) ?? (await db.getOrCreateSundayByDate(date));

  const [slides, templates, colors, stepperData] = await Promise.all([
    db.listSlidesForSunday(sunday.id),
    db.listTemplates(),
    db.listApprovedColors(),
    buildSundayStepperData(sunday.id, date),
  ]);

  const templatesById = buildTemplatesById(templates);
  const colorMap = buildColorHexById(colors);
  const assets = await resolveAssetsByIds(collectBackgroundAssetIds(slides, templatesById));

  return (
    <SundayShell>
      <SundayStepper date={date} locale={locale} data={stepperData} active="download" />
      <DownloadClient
        date={date}
        sundayId={sunday.id}
        slides={slides}
        templatesById={templatesById}
        colorHexById={colorMap}
        assets={assets}
        initialHoldSeconds={sunday.defaultSlideHoldSeconds}
      />
    </SundayShell>
  );
}
