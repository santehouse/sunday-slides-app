"use client";

import { useFormatter } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { WeekSwitcher, type WeekSwitcherSize } from "@/components/ui/WeekSwitcher";
import { serviceDateToDate } from "@/lib/utils/serviceDate";

export type SundayWeekSwitcherProps = {
  date: string;
  prevDate: string;
  nextDate: string;
  size?: WeekSwitcherSize;
};

/** Wires the `WeekSwitcher` master to Sunday-date navigation (`/sunday/[date]`). */
export function SundayWeekSwitcher({ date, prevDate, nextDate, size = "md" }: SundayWeekSwitcherProps) {
  const router = useRouter();
  const format = useFormatter();
  const dateObj = serviceDateToDate(date);

  return (
    <WeekSwitcher
      date={dateObj}
      label={format.dateTime(dateObj, "sundayShort")}
      size={size}
      onPrev={() => router.push(`/sunday/${prevDate}`)}
      onNext={() => router.push(`/sunday/${nextDate}`)}
    />
  );
}
