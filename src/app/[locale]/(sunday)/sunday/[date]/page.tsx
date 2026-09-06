import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/lib/data";
import { isSundayDate, serviceDateToDate } from "@/lib/utils/serviceDate";
import {
  buildColorHexById,
  buildSundayStepperData,
  buildTemplatesById,
  collectBackgroundAssetIds,
  resolveAssetUrl,
  resolveAssetsByIds,
} from "@/lib/sunday/view";
import type { ResolvedAsset } from "@/lib/renderer/types";
import { SundayShell } from "@/components/shell/SundayShell";
import { SundayStepper } from "@/components/sunday/SundayStepper";
import { CheckSlidesClient } from "@/components/sunday/CheckSlidesClient";
import { ToastProvider } from "@/components/ui/Toast";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; date: string }>;
}): Promise<Metadata> {
  const { locale, date } = await params;
  const t = await getTranslations({ locale, namespace: "sunday.simple.stepper" });
  return { title: `${t("step2Label")} — ${serviceDateToDate(date).toDateString()}` };
}

export default async function CheckSlidesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; date: string }>;
  searchParams: Promise<{ slide?: string; add?: string }>;
}) {
  const { locale, date } = await params;
  const { slide: selectedSlideParam, add } = await searchParams;
  setRequestLocale(locale);

  const db = getDb();
  if (!isSundayDate(date)) notFound();
  const sunday = (await db.getSundayByDate(date)) ?? (await db.getOrCreateSundayByDate(date));

  const [slides, allTemplates, published, allColors, enabledColors, settings, stepperData] = await Promise.all([
    db.listSlidesForSunday(sunday.id),
    db.listTemplates(),
    db.listTemplates({ status: "published" }),
    db.listApprovedColors(),
    db.listApprovedColors({ enabledOnly: true }),
    db.getSettings(),
    buildSundayStepperData(sunday.id, date),
  ]);

  // The edit panel's template select and the "add a slide" picker only ever offer Published
  // templates — but a slide already on a since-unpublished template still needs its own
  // template present so the select shows something and its background assets resolve.
  const publishedIds = new Set(published.map((tpl) => tpl.id));
  const extraTemplateIds = [...new Set(slides.map((s) => s.templateId).filter((id) => !publishedIds.has(id)))];
  const extraTemplates = (await Promise.all(extraTemplateIds.map((id) => db.getTemplate(id)))).filter(
    (tpl): tpl is NonNullable<typeof tpl> => tpl !== null,
  );
  const publishedTemplates = [...published, ...extraTemplates];

  const templatesById = buildTemplatesById(allTemplates);
  const colorMap = buildColorHexById(allColors);

  const backgroundAssetIds = [
    ...collectBackgroundAssetIds(slides, templatesById),
    ...publishedTemplates.filter((tpl) => tpl.backgroundType === "image").map((tpl) => tpl.backgroundValue),
  ];
  const assets = await resolveAssetsByIds(backgroundAssetIds);

  const assetsByTemplateId: Record<string, ResolvedAsset[]> = {};
  await Promise.all(
    publishedTemplates.map(async (tpl) => {
      const tplAssets = await db.listAssetsForTemplate(tpl.id, { publishedOnly: true });
      assetsByTemplateId[tpl.id] = await Promise.all(tplAssets.map(async (asset) => ({ asset, url: await resolveAssetUrl(asset) })));
    }),
  );

  return (
    <SundayShell>
      <ToastProvider>
        <SundayStepper date={date} locale={locale} data={stepperData} active="check" />

        <CheckSlidesClient
          date={date}
          sundayId={sunday.id}
          slides={slides}
          templatesById={templatesById}
          colorHexById={colorMap}
          colors={enabledColors.map((c) => ({ id: c.id, nameEn: c.nameEn, nameFr: c.nameFr, hex: c.hex }))}
          assets={assets}
          publishedTemplates={publishedTemplates}
          assetsByTemplateId={assetsByTemplateId}
          safeZone={settings.safeZone}
          initialSelectedId={selectedSlideParam ?? null}
          initialAdd={add === "1"}
        />
      </ToastProvider>
    </SundayShell>
  );
}
