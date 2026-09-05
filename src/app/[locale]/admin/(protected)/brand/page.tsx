import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/lib/data";
import { BrandClient } from "./BrandClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.brand" });
  return { title: t("title") };
}

export default async function BrandPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const db = getDb();
  const [fonts, colors, settings] = await Promise.all([
    db.listFonts(),
    db.listApprovedColors(),
    db.getSettings(),
  ]);

  return <BrandClient fonts={fonts} colors={colors} churchName={settings.churchName} />;
}
