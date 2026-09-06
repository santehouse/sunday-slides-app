import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/lib/data";
import { isSundayDate } from "@/lib/utils/serviceDate";
import { buildSundayStepperData } from "@/lib/sunday/view";
import { SundayShell } from "@/components/shell/SundayShell";
import { SundayStepper } from "@/components/sunday/SundayStepper";
import { RunSheetInbox, type InboxItemData } from "@/components/sunday/RunSheetInbox";

const INBOX_LIMIT = 20;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sunday.simple.inbox" });
  return { title: t("pageTitle") };
}

export default async function RunSheetInboxPage({
  params,
}: {
  params: Promise<{ locale: string; date: string }>;
}) {
  const { locale, date } = await params;
  setRequestLocale(locale);

  const db = getDb();
  if (!isSundayDate(date)) notFound();
  const sunday = (await db.getSundayByDate(date)) ?? (await db.getOrCreateSundayByDate(date));

  const [sundays, stepperData] = await Promise.all([db.listSundays(), buildSundayStepperData(sunday.id, date)]);

  const runSheetsBySunday = await Promise.all(
    sundays.map(async (s) => ({ serviceDate: s.serviceDate, runSheets: await db.listRunSheetsForSunday(s.id) })),
  );

  const items: InboxItemData[] = runSheetsBySunday
    .flatMap(({ serviceDate, runSheets }) =>
      runSheets.map(
        (rs): InboxItemData => ({
          runSheetId: rs.id,
          filename: rs.originalFilename,
          sourceType: rs.sourceType,
          receivedAt: rs.receivedAt,
          parseStatus: rs.parseStatus,
          forDate: serviceDate,
        }),
      ),
    )
    .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1))
    .slice(0, INBOX_LIMIT);

  return (
    <SundayShell>
      <SundayStepper date={date} locale={locale} data={stepperData} active="runSheet" />
      <RunSheetInbox date={date} items={items} />
    </SundayShell>
  );
}
