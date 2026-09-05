import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/lib/data";
import { resolveAssetUrls } from "@/components/admin/assetUrl";
import { StudioClient } from "./StudioClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const db = getDb();
  const template = await db.getTemplate(id);
  const t = await getTranslations({ locale, namespace: "admin.templates" });
  return { title: template ? `${template.nameEn} · ${t("studioTitle")}` : t("studioTitle") };
}

export default async function TemplateStudioPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const db = getDb();
  const template = await db.getTemplate(id);
  if (!template) notFound();

  const [assets, fonts, settings] = await Promise.all([
    db.listAssets({ status: "published" }),
    db.listFonts(),
    db.getSettings(),
  ]);
  const assetUrls = await resolveAssetUrls(assets);

  return (
    <StudioClient
      template={template}
      assets={assets}
      assetUrls={assetUrls}
      fonts={fonts}
      safeZone={settings.safeZone}
    />
  );
}
