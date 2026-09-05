import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";

export type SundayPageHeaderTitleSize = "xl" | "lg" | "md";

// xl (Dashboard, 32) and lg (Flow/Add/Upload, 30) both map to the h1 token
// (32px) — the nearest allowed type-scale utility; lg is a deliberate 2px
// deviation from the Figma spec rather than introducing an arbitrary size.
const TITLE_CLASSES: Record<SundayPageHeaderTitleSize, string> = {
  xl: "text-h1",
  lg: "text-h1",
  md: "text-h2",
};

export type SundayPageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  backHref?: string;
  actions?: ReactNode;
  titleSize?: SundayPageHeaderTitleSize;
  className?: string;
};

/** Figma "Sunday Page Header" master (node 87:472) — Dashboard/Flow/Editor/Add Slide/Upload Run Sheet. */
export function SundayPageHeader({
  title,
  subtitle,
  backHref,
  actions,
  titleSize = "xl",
  className,
}: SundayPageHeaderProps) {
  const t = useTranslations("common");
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {backHref ? (
          <Link href={backHref} aria-label={t("back")} className="shrink-0 text-fg">
            <ArrowLeft aria-hidden="true" size={24} />
          </Link>
        ) : null}
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className={cn("truncate font-bold text-fg", TITLE_CLASSES[titleSize])}>{title}</h1>
          {subtitle ? <p className="text-label font-normal text-fg-secondary">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-start gap-2.5">{actions}</div> : null}
    </div>
  );
}
