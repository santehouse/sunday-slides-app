"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import type { Locale } from "@/lib/domain/types";
import { syncAdminLocaleAction } from "@/app/[locale]/admin/(protected)/locale-actions";

/**
 * Invisible sync: whenever the active locale changes (via the account menu's
 * `LanguageSelector`, which switches the URL immediately on its own), persist
 * it onto the signed-in admin's account so it follows them to another device.
 */
export function AdminLocaleSync() {
  const locale = useLocale() as Locale;
  const previous = useRef<Locale>(locale);

  useEffect(() => {
    if (previous.current === locale) return;
    previous.current = locale;
    void syncAdminLocaleAction(locale);
  }, [locale]);

  return null;
}
