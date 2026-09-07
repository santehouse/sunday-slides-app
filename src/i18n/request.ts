import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: process.env.APP_TIMEZONE ?? "America/Toronto",
    formats: {
      dateTime: {
        sundayLong: { weekday: "long", month: "long", day: "numeric" },
        sundayShort: { weekday: "long", month: "short", day: "numeric" },
        monthDay: { month: "long", day: "numeric" },
        dateMedium: { year: "numeric", month: "short", day: "numeric" },
        time: { hour: "numeric", minute: "2-digit" },
        dayTime: { weekday: "long", hour: "numeric", minute: "2-digit" },
      },
    },
  };
});
