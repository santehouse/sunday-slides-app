import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/lib/data";
import { resolveAssetUrls } from "@/components/admin/assetUrl";
import { AssetsClient } from "./AssetsClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.assets" });
  return { title: t("title") };
}

export default async function AssetsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const db = getDb();
  const [assets, templates] = await Promise.all([db.listAssets(), db.listTemplates()]);
  const assetUrls = await resolveAssetUrls(assets);

  const templateOptions = templates.map((t) => ({
    id: t.id,
    nameEn: t.nameEn,
    nameFr: t.nameFr,
    allowedAssetIds: t.allowedAssetIds,
  }));

  return <AssetsClient assets={assets} assetUrls={assetUrls} templates={templateOptions} />;
}
