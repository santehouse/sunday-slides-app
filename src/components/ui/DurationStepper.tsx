import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { IconButton, type IconButtonSize } from "./IconButton";

export type DurationStepperSize = "md" | "lg";

const SIZE_CONFIG: Record<DurationStepperSize, { button: IconButtonSize; value: string; label: string }> = {
  md: { button: 40, value: "text-[22px]", label: "text-caption" },
  lg: { button: 44, value: "text-[26px]", label: "text-[13px]" },
};

export type DurationStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  size?: DurationStepperSize;
  className?: string;
};

/** Figma "Duration Stepper" master (node 68:1172). Min 1 / max 30 seconds by default. */
export function DurationStepper({
  value,
  onChange,
  min = 1,
  max = 30,
  step = 1,
  size = "md",
  className,
}: DurationStepperProps) {
  const t = useTranslations("sunday.dashboard");
  const tCommon = useTranslations("common");
  const config = SIZE_CONFIG[size];
  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <p className={cn(config.label, "text-fg-secondary")}>{t("defaultSlideDuration")}</p>
      <div className="flex flex-1 items-center justify-between">
        <p className={cn(config.value, "font-bold text-fg")}>{tCommon("seconds", { count: value })}</p>
        <div className="flex items-center gap-2">
          <IconButton
            icon={Minus}
            size={config.button}
            variant="outlined"
            aria-label={t("decreaseDuration")}
            disabled={atMin}
            onClick={() => onChange(Math.max(min, value - step))}
          />
          <IconButton
            icon={Plus}
            size={config.button}
            variant="outlined"
            aria-label={t("increaseDuration")}
            disabled={atMax}
            onClick={() => onChange(Math.min(max, value + step))}
          />
        </div>
      </div>
    </div>
  );
}
