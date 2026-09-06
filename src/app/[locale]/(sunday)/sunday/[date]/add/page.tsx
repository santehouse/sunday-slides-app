import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/lib/data";
import { resolveAssetsByIds } from "@/lib/sunday/view";
import { serviceDateToDate } from "@/lib/utils/serviceDate";
import { SundayShell } from "@/components/shell/SundayShell";
import { SundayPageHeader } from "@/components/shell/SundayPageHeader";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Button } from "@/components/ui/Button";
import { AddSlideClient } from "./AddSlideClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sunday.addSlide" });
  return { title: t("title") };
}

export default async function AddSlidePage({
  params,
}: {
  params: Promise<{ locale: string; date: string }>;
}) {
  const { locale, date } = await params;
  setRequestLocale(locale);

  const db = getDb();
  const sunday = await db.getSundayByDate(date);
  if (!sunday) notFound();

  const templates = await db.listTemplates({ status: "published" });
  const backgroundAssetIds = templates
    .filter((tpl) => tpl.backgroundType === "image")
    .map((tpl) => tpl.backgroundValue);
  const assets = await resolveAssetsByIds(backgroundAssetIds);

  const t = await getTranslations("sunday.addSlide");
  const tCommon = await getTranslations("common");
  const tTabs = await getTranslations("sunday.tabs");
  const format = await getFormatter({ locale });

  return (
    <SundayShell>
      <Breadcrumb
        items={[
          { label: format.dateTime(serviceDateToDate(date), "sundayShort"), href: `/sunday/${date}` },
          { label: tTabs("flow"), href: `/sunday/${date}/flow` },
          { label: t("title") },
        ]}
      />
      <SundayPageHeader
        titleSize="lg"
        title={t("title")}
        backHref={`/sunday/${date}/flow`}
        actions={
          <Button variant="secondary" href={`/sunday/${date}/flow`}>
            {tCommon("cancel")}
          </Button>
        }
      />
      <p className="text-[13px] text-fg-secondary">{t("helper")}</p>
      <AddSlideClient sundayId={sunday.id} date={date} templates={templates} assets={assets} />
    </SundayShell>
  );
}
