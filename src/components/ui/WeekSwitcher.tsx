import { ArrowLeft, ArrowRight, Calendar } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { IconButton, type IconButtonSize } from "./IconButton";

export type WeekSwitcherSize = "md" | "lg";

const SIZE_CONFIG: Record<
  WeekSwitcherSize,
  { container: string; arrow: IconButtonSize; calendar: number; text: string }
> = {
  md: { container: "h-12 w-[220px]", arrow: 40, calendar: 18, text: "text-label" },
  lg: { container: "h-14 w-[260px]", arrow: 48, calendar: 24, text: "text-body" },
};

export type WeekSwitcherProps = {
  date: Date;
  onPrev: () => void;
  onNext: () => void;
  /** Locale-formatted date string, e.g. "Sunday, Sep 6" / "dimanche 6 sept." */
  label: string;
  size?: WeekSwitcherSize;
  className?: string;
};

/** Figma "Week Switcher" master (node 68:53). */
export function WeekSwitcher({ date, onPrev, onNext, label, size = "md", className }: WeekSwitcherProps) {
  const t = useTranslations("sunday.dashboard");
  const config = SIZE_CONFIG[size];
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1 rounded-[12px] border border-border bg-surface p-1",
        config.container,
        className,
      )}
    >
      <IconButton
        icon={ArrowLeft}
        size={config.arrow}
        radius={8}
        variant="ghost"
        aria-label={t("previousSunday")}
        onClick={onPrev}
      />
      <div className="flex flex-1 items-center justify-center gap-2 px-1">
        <Calendar aria-hidden="true" size={config.calendar} className="shrink-0 text-fg" />
        <time dateTime={date.toISOString()} className={cn("truncate font-bold text-fg", config.text)}>
          {label}
        </time>
      </div>
      <IconButton
        icon={ArrowRight}
        size={config.arrow}
        radius={8}
        variant="ghost"
        aria-label={t("nextSunday")}
        onClick={onNext}
      />
    </div>
  );
}
