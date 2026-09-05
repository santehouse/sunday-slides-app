import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/lib/data";
import { SundaysClient } from "./SundaysClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.sundays" });
  return { title: t("title") };
}

export default async function SundaysPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ upload?: string }>;
}) {
  const { locale } = await params;
  const { upload } = await searchParams;
  setRequestLocale(locale);

  const db = getDb();
  const [sundays, settings] = await Promise.all([db.listSundays(), db.getSettings()]);

  return (
    <SundaysClient sundays={sundays} inboundEmail={settings.inboundEmail} initialUploadOpen={upload === "1"} />
  );
}
