import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/lib/data";
import { serviceDateToDate } from "@/lib/utils/serviceDate";
import { buildColorHexById, buildTemplatesById, collectBackgroundAssetIds, resolveAssetsByIds } from "@/lib/sunday/view";
import { SundayShell } from "@/components/shell/SundayShell";
import { SundayPageHeader } from "@/components/shell/SundayPageHeader";
import { Button } from "@/components/ui/Button";
import { ToastProvider } from "@/components/ui/Toast";
import { ExportPopover } from "@/components/sunday/ExportPopover";
import { FlowClient } from "./FlowClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sunday.flow" });
  return { title: t("title") };
}

export default async function SundayFlowPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; date: string }>;
  searchParams: Promise<{ slide?: string }>;
}) {
  const { locale, date } = await params;
  const { slide: selectedSlideParam } = await searchParams;
  setRequestLocale(locale);

  const db = getDb();
  const sunday = await db.getSundayByDate(date);
  if (!sunday) notFound();

  const [slides, templates, colors, settings] = await Promise.all([
    db.listSlidesForSunday(sunday.id),
    db.listTemplates(),
    db.listApprovedColors(),
    db.getSettings(),
  ]);

  const templatesMap = buildTemplatesById(templates);
  const colorMap = buildColorHexById(colors);
  const assets = await resolveAssetsByIds(collectBackgroundAssetIds(slides, templatesMap));

  const t = await getTranslations("sunday.flow");
  const tCommon = await getTranslations("common");

  return (
    <SundayShell>
      {/* One shared ToastProvider for the whole page — ExportPopover (in the header) and
          FlowClient (below) both call useToast() and must share the same provider. */}
      <ToastProvider>
        <SundayPageHeader
          titleSize="lg"
          title={t("title")}
          subtitle={t("subtitle", {
            date: serviceDateToDate(date),
            slides: tCommon("slidesCount", { count: slides.length }),
            seconds: tCommon("seconds", { count: sunday.defaultSlideHoldSeconds }),
          })}
          actions={
            <>
              <Button variant="secondary" href={`/sunday/${date}/upload`}>
                {t("uploadRunSheet")}
              </Button>
              <Button variant="secondary" href={`/sunday/${date}/add`}>
                {t("addSlide")}
              </Button>
              <ExportPopover
                sundayId={sunday.id}
                slides={slides}
                templatesById={templatesMap}
                colorHexById={colorMap}
                assets={assets}
                currentSlideId={selectedSlideParam ?? slides[0]?.id ?? null}
              />
            </>
          }
        />

        <FlowClient
          date={date}
          sundayId={sunday.id}
          slides={slides}
          templatesById={templatesMap}
          colorHexById={colorMap}
          assets={assets}
          safeZone={settings.safeZone}
          initialSelectedId={selectedSlideParam ?? null}
        />
      </ToastProvider>
    </SundayShell>
  );
}
