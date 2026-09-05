import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getDb } from "@/lib/data";
import { todayInTimezone } from "@/lib/utils/serviceDate";

/** `/sunday` — resolves the current/upcoming Sunday and redirects to `/sunday/[date]`. */
export default async function SundayIndexPage() {
  const db = getDb();
  const settings = await db.getSettings();
  const today = todayInTimezone(settings.timezone);
  const sunday = await db.getNextSunday(today, { create: true });
  const locale = await getLocale();
  redirect({ href: `/sunday/${sunday!.serviceDate}`, locale });
}
