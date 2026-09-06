import type { MouseEvent } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";

export type BreadcrumbItem = {
  label: string;
  /** Omit for the current page — rendered as plain text, not a link. */
  href?: string;
  /** Lets a caller intercept navigation (e.g. an unsaved-changes confirm). */
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

export type BreadcrumbProps = {
  items: BreadcrumbItem[];
  className?: string;
};

/** Drill-in screens (Slide Editor, Add Slide) render this above their title. */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  const t = useTranslations("common");
  return (
    <nav aria-label={t("breadcrumb")} className={cn("flex min-w-0 items-center gap-1.5 text-caption text-fg-secondary", className)}>
      {items.map((item, index) => (
        <span key={index} className="flex min-w-0 items-center gap-1.5 last:min-w-0">
          {index > 0 ? <ChevronRight aria-hidden="true" size={16} className="shrink-0" /> : null}
          {item.href ? (
            <Link href={item.href} onClick={item.onClick} className="truncate hover:text-fg hover:underline">
              {item.label}
            </Link>
          ) : (
            <span aria-current="page" className="truncate">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
