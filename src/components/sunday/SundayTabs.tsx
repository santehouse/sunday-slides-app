"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";

export type SundayTabsProps = {
  date: string;
  /** Count of slides with status `needs_review`, shown as a pill on the Flow tab. */
  needsReviewCount?: number;
  className?: string;
};

type TabKey = "overview" | "flow" | "runSheet";

/**
 * Contextual nav for the three top-level Sunday screens (Overview, Flow, Run sheet).
 * Sits directly under the `SundayPageHeader` on all three.
 */
export function SundayTabs({ date, needsReviewCount = 0, className }: SundayTabsProps) {
  const t = useTranslations("sunday.tabs");
  const pathname = usePathname();

  const tabs: { key: TabKey; href: string; label: string }[] = [
    { key: "overview", href: `/sunday/${date}`, label: t("overview") },
    { key: "flow", href: `/sunday/${date}/flow`, label: t("flow") },
    { key: "runSheet", href: `/sunday/${date}/upload`, label: t("runSheet") },
  ];

  function isActive(tabHref: string, key: TabKey) {
    if (key === "overview") return pathname === tabHref;
    return pathname === tabHref || pathname.startsWith(`${tabHref}/`);
  }

  return (
    <nav aria-label={t("label")} className={cn("flex h-10 items-stretch gap-6 border-b border-border", className)}>
      {tabs.map((tab) => {
        const active = isActive(tab.href, tab.key);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 border-b-2 text-label font-bold transition-colors duration-[250ms]",
              active ? "border-primary text-fg" : "border-transparent text-fg-secondary hover:text-fg",
            )}
          >
            {tab.label}
            {tab.key === "flow" && needsReviewCount > 0 ? (
              <span
                aria-label={t("needsReviewCount", { count: needsReviewCount })}
                className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-warning-bg px-1.5 py-0.5 text-[11px] font-bold leading-none text-warning-fg"
              >
                {needsReviewCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
