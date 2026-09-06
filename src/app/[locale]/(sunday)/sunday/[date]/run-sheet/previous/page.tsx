import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/lib/data";
import { serviceDateToDate } from "@/lib/utils/serviceDate";
import { SundayShell } from "@/components/shell/SundayShell";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sunday.simple.previous" });
  return { title: t("title") };
}

/** Step 1's "Previous Sundays" — a simple read-only list, each opening straight to that Sunday's Step 2. */
export default async function PreviousSundaysPage({
  params,
}: {
  params: Promise<{ locale: string; date: string }>;
}) {
  const { locale, date } = await params;
  setRequestLocale(locale);

  const db = getDb();
  const sundays = await db.listSundays();
  const t = await getTranslations("sunday.simple.previous");
  const tCommon = await getTranslations("common");
  const format = await getFormatter({ locale });

  return (
    <SundayShell>
      <div className="flex items-center gap-2.5">
        <Link href={`/sunday/${date}/run-sheet`} aria-label={tCommon("back")} className="text-fg">
          <ArrowLeft aria-hidden="true" size={24} />
        </Link>
        <h1 className="text-[24px] font-bold leading-tight text-fg">{t("title")}</h1>
      </div>

      <Card padding="none" className="flex flex-col gap-2.5 p-[18px]">
        {sundays.length === 0 ? (
          <p className="text-label text-fg-secondary">{t("empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sundays.map((s) => (
              <li key={s.id} className="flex h-14 items-center justify-between gap-3 rounded-md bg-surface-subtle px-3.5">
                <p className="text-label font-bold text-fg">{format.dateTime(serviceDateToDate(s.serviceDate), "sundayShort")}</p>
                <p className="text-caption text-fg-secondary">{tCommon("slidesCount", { count: s.slideCounts.total })}</p>
                <Button variant="secondary" size="sm" href={`/sunday/${s.serviceDate}`}>
                  {t("open")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Link href={`/sunday/${date}/run-sheet`} className="text-label font-bold text-fg-secondary hover:underline">
        {t("back")}
      </Link>
    </SundayShell>
  );
}
