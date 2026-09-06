"use client";

import { useFormatter } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { WeekSwitcher, type WeekSwitcherSize } from "@/components/ui/WeekSwitcher";
import { serviceDateToDate } from "@/lib/utils/serviceDate";

export type SundayWeekSwitcherProps = {
  date: string;
  prevDate: string;
  nextDate: string;
  size?: WeekSwitcherSize;
};

// Only the three tab sections carry over across a week switch — a deep link (Add
// Slide, Slide Editor) falls back to Overview, since the adjacent Sunday has no
// equivalent slide/template to land on.
const CARRYABLE_SECTIONS = ["/flow", "/upload"];

function sectionSuffix(pathname: string, date: string): string {
  const rest = pathname.startsWith(`/sunday/${date}`) ? pathname.slice(`/sunday/${date}`.length) : "";
  return CARRYABLE_SECTIONS.includes(rest) ? rest : "";
}

/** Wires the `WeekSwitcher` master to Sunday-date navigation (`/sunday/[date]`), keeping the current tab. */
export function SundayWeekSwitcher({ date, prevDate, nextDate, size = "md" }: SundayWeekSwitcherProps) {
  const router = useRouter();
  const format = useFormatter();
  const pathname = usePathname();
  const dateObj = serviceDateToDate(date);
  const suffix = sectionSuffix(pathname, date);

  return (
    <WeekSwitcher
      date={dateObj}
      label={format.dateTime(dateObj, "sundayShort")}
      size={size}
      onPrev={() => router.push(`/sunday/${prevDate}${suffix}`)}
      onNext={() => router.push(`/sunday/${nextDate}${suffix}`)}
    />
  );
}
