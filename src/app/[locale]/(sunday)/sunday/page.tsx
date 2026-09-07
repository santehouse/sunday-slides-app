import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/lib/data";
import { todayInTimezone } from "@/lib/utils/serviceDate";
import {
  buildColorHexById,
  buildTemplatesById,
  collectBackgroundAssetIds,
  resolveAssetUrl,
  resolveAssetsByIds,
} from "@/lib/sunday/view";
import type { ResolvedAsset } from "@/lib/renderer/types";
import { SundayShell } from "@/components/shell/SundayShell";
import { SundayQueueClient } from "@/components/sunday/SundayQueueClient";
import { ToastProvider } from "@/components/ui/Toast";
import type { RecentRunSheetData } from "@/components/sunday/ImportModal";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sunday.queue" });
  return { title: t("title") };
}

/** Newest first, across every service — the team may use any of them (see intake.applyRunSheetToSunday). */
const RECENT_RUN_SHEETS_LIMIT = 10;

/**
 * `/sunday` — the single Sunday Team screen (simplified IA): one queue of slides for the
 * current service, everything else (import, new slide, edit, export) in near-full-screen
 * modals. The "current service" is always the upcoming Sunday — there is no date
 * navigation any more.
 */
export default async function SundayQueuePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ slide?: string; add?: string; import?: string }>;
}) {
  const { locale } = await params;
  const { slide, add, import: importParam } = await searchParams;
  setRequestLocale(locale);

  const db = getDb();
  const settings = await db.getSettings();
  const today = todayInTimezone(settings.timezone);
  const sunday = await db.getNextSunday(today, { create: true });

  const [slides, allTemplates, published, allColors, enabledColors, recentRunSheets] = await Promise.all([
    db.listSlidesForSunday(sunday!.id),
    db.listTemplates(),
    db.listTemplates({ status: "published" }),
    db.listApprovedColors(),
    db.listApprovedColors({ enabledOnly: true }),
    db.listRecentRunSheets(RECENT_RUN_SHEETS_LIMIT),
  ]);

  // The Edit/New-slide template pickers only ever offer Published templates — but a slide
  // already on a since-unpublished template still needs its own template present so the
  // select shows something and its background assets resolve.
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

  const recentFiles: RecentRunSheetData[] = recentRunSheets.map((rs) => ({
    id: rs.id,
    filename: rs.originalFilename,
    sourceType: rs.sourceType,
    receivedAt: rs.receivedAt,
    openedAt: rs.openedAt,
    parseStatus: rs.parseStatus,
    mimeType: rs.mimeType,
  }));

  return (
    <SundayShell>
      <ToastProvider>
        <SundayQueueClient
          sundayId={sunday!.id}
          serviceDate={sunday!.serviceDate}
          holdSeconds={sunday!.defaultSlideHoldSeconds}
          slides={slides}
          templatesById={templatesById}
          colorHexById={colorMap}
          colors={enabledColors.map((c) => ({ id: c.id, nameEn: c.nameEn, nameFr: c.nameFr, hex: c.hex }))}
          assets={assets}
          publishedTemplates={publishedTemplates}
          assetsByTemplateId={assetsByTemplateId}
          safeZone={settings.safeZone}
          recentFiles={recentFiles}
          initialSelectedSlideId={slide ?? null}
          initialAdd={add === "1"}
          initialImport={importParam === "1"}
        />
      </ToastProvider>
    </SundayShell>
  );
}
