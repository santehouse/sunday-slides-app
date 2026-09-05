import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";

export type SundayPageHeaderTitleSize = "xl" | "lg" | "md";

// Exact px per screen from the Figma "Sunday Page Header" master (node 87:472):
// xl = Dashboard (32), lg = Flow/Add Slide/Upload Run Sheet (30), md = Editor (24).
const TITLE_CLASSES: Record<SundayPageHeaderTitleSize, string> = {
  xl: "text-[32px] leading-tight",
  lg: "text-[30px] leading-tight",
  md: "text-[24px] leading-tight",
};

// Dashboard subtitle is 14px, Flow's is 13px.
const SUBTITLE_CLASSES: Record<SundayPageHeaderTitleSize, string> = {
  xl: "text-[14px] leading-[20px]",
  lg: "text-[13px] leading-[18px]",
  md: "text-[14px] leading-[20px]",
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
          {subtitle ? (
            <p className={cn("font-normal text-fg-secondary", SUBTITLE_CLASSES[titleSize])}>{subtitle}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-start gap-2.5">{actions}</div> : null}
    </div>
  );
}
