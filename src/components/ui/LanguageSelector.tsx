"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { SegmentedControl } from "./SegmentedControl";
import { VisuallyHidden } from "./VisuallyHidden";

export type LanguageSelectorSize = "sm" | "md";

export type LanguageSelectorProps = {
  size?: LanguageSelectorSize;
  /** Called after the locale switch is issued — useful for persisting an admin's preference. */
  onChange?: (locale: AppLocale) => void;
  className?: string;
};

const SIZE_WIDTH: Record<LanguageSelectorSize, string> = {
  sm: "w-[88px]",
  md: "w-[104px]",
};

/**
 * Figma "Language Selector" master (node 83:1135), built on SegmentedControl
 * in its `primary` variant. Switches the app locale via next-intl navigation;
 * the locale cookie is set by next-intl itself.
 */
export function LanguageSelector({ size = "sm", onChange, className }: LanguageSelectorProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("language");
  const router = useRouter();
  const pathname = usePathname();

  const active: "en" | "fr" = locale === "fr-CA" ? "fr" : "en";
  const currentName = active === "en" ? t("englishName") : t("frenchName");

  function handleChange(next: "en" | "fr") {
    const nextLocale: AppLocale = next === "fr" ? "fr-CA" : "en";
    if (nextLocale === locale) return;
    router.replace(pathname, { locale: nextLocale });
    onChange?.(nextLocale);
  }

  return (
    <div className={className}>
      <SegmentedControl
        ariaLabel={t("label")}
        value={active}
        onChange={handleChange}
        size={size}
        variant="primary"
        equalWidth
        className={SIZE_WIDTH[size]}
        options={[
          { value: "en", label: t("en") },
          { value: "fr", label: t("fr") },
        ]}
      />
      <VisuallyHidden>
        <span role="status">{t("current", { language: currentName })}</span>
      </VisuallyHidden>
    </div>
  );
}
