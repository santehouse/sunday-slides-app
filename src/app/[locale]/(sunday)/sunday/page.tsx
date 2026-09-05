import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getDb } from "@/lib/data";

/** Formats "now" as a YYYY-MM-DD date string in `timezone` (Intl, no library dependency). */
function todayInTimezone(timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

/** `/sunday` — resolves the current/upcoming Sunday and redirects to `/sunday/[date]`. */
export default async function SundayIndexPage() {
  const db = getDb();
  const settings = await db.getSettings();
  const today = todayInTimezone(settings.timezone);
  const sunday = await db.getNextSunday(today, { create: true });
  const locale = await getLocale();
  redirect({ href: `/sunday/${sunday!.serviceDate}`, locale });
}
