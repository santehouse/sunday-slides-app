import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/lib/data";
import { resolveAssetUrls } from "@/components/admin/assetUrl";
import { TemplatesClient } from "./TemplatesClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.templates" });
  return { title: t("libraryTitle") };
}

export default async function TemplatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const db = getDb();
  const [templates, assets] = await Promise.all([db.listTemplates(), db.listAssets()]);
  const backgroundAssets = templates
    .filter((t) => t.backgroundType === "image")
    .map((t) => assets.find((a) => a.id === t.backgroundValue))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
  const assetUrls = await resolveAssetUrls(backgroundAssets);

  return <TemplatesClient templates={templates} assetUrls={assetUrls} />;
}
