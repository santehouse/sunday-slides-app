import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { KitGallery } from "./KitGallery";

// QA-only component gallery — not linked from product navigation.
// Visit /kit (EN) or /fr/kit (FR-CA) to screenshot every ui-kit variant/state.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dev.kit" });
  return { title: t("title") };
}

export default async function KitPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <KitGallery />;
}
