import { defineRouting } from "next-intl/routing";

export const locales = ["en", "fr-CA"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "en";

/**
 * English is the default locale with no prefix ("/sunday").
 * French Canadian is served under "/fr" ("/fr/sunday") — the short prefix is a
 * URL alias for the fr-CA locale; the document `lang` is always "fr-CA".
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: {
    mode: "as-needed",
    prefixes: { "fr-CA": "/fr" },
  },
  localeCookie: {
    name: "cp_locale",
    maxAge: 60 * 60 * 24 * 365,
  },
});

export function isAppLocale(value: string): value is AppLocale {
  return (locales as readonly string[]).includes(value);
}
