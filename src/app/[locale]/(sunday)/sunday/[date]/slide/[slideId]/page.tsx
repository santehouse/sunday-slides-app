import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/lib/data";
import { resolveAssetUrl } from "@/lib/sunday/view";
import type { ResolvedAsset } from "@/lib/renderer/types";
import { SundayShell } from "@/components/shell/SundayShell";
import { EditorClient } from "./EditorClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sunday.editor" });
  return { title: t("content") };
}

export default async function SlideEditorPage({
  params,
}: {
  params: Promise<{ locale: string; date: string; slideId: string }>;
}) {
  const { locale, date, slideId } = await params;
  setRequestLocale(locale);

  const db = getDb();
  const [sunday, slide, settings] = await Promise.all([
    db.getSundayByDate(date),
    db.getSlide(slideId),
    db.getSettings(),
  ]);
  if (!sunday || !slide || slide.sundayId !== sunday.id) notFound();

  const published = await db.listTemplates({ status: "published" });
  let templates = published;
  if (!templates.some((tpl) => tpl.id === slide.templateId)) {
    const current = await db.getTemplate(slide.templateId);
    if (current) templates = [current, ...templates];
  }

  const assetsByTemplateId: Record<string, ResolvedAsset[]> = {};
  await Promise.all(
    templates.map(async (tpl) => {
      const assets = await db.listAssetsForTemplate(tpl.id, { publishedOnly: true });
      assetsByTemplateId[tpl.id] = await Promise.all(
        assets.map(async (asset) => ({ asset, url: await resolveAssetUrl(asset) })),
      );
    }),
  );

  const colors = await db.listApprovedColors({ enabledOnly: true });

  return (
    <SundayShell>
      <EditorClient
        date={date}
        slide={slide}
        templates={templates}
        assetsByTemplateId={assetsByTemplateId}
        colors={colors.map((c) => ({ id: c.id, nameEn: c.nameEn, nameFr: c.nameFr, hex: c.hex }))}
        safeZone={settings.safeZone}
      />
    </SundayShell>
  );
}
