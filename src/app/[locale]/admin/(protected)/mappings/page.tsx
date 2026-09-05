import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/lib/data";
import { MappingsClient } from "./MappingsClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.mappings" });
  return { title: t("title") };
}

export default async function MappingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const db = getDb();
  const todayIso = new Date().toISOString().slice(0, 10);
  const [mappings, suggestions, templates, latestSunday] = await Promise.all([
    db.listMappings(),
    db.listMappingSuggestions(),
    db.listTemplates({ status: "published" }),
    db.getNextSunday(todayIso, { create: false }),
  ]);

  const latestRunSheet = latestSunday ? await db.getLatestRunSheetForSunday(latestSunday.id) : null;
  const mappedKeys = new Set(mappings.map((m) => m.canonicalKey));
  const unmappedHeadlines =
    latestRunSheet?.parsedJson?.sections.flatMap((section) =>
      section.announcements.filter((a) => !a.canonicalKey || !mappedKeys.has(a.canonicalKey)),
    ) ?? [];

  return (
    <MappingsClient
      mappings={mappings}
      suggestions={suggestions.filter((s) => !s.dismissedAt)}
      templates={templates}
      unmappedAnnouncements={unmappedHeadlines}
    />
  );
}
