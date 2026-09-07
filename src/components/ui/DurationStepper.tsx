import { useEffect, useRef, type ReactNode } from "react";
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
  /** Overrides the built-in "Default slide duration" caption — e.g. Step 3's plainer
      "Seconds per slide in the video" wording. Pass `false` to render no caption at all
      (the caller supplies its own label alongside the control). */
  label?: ReactNode | false;
  className?: string;
};

/** Figma "Duration Stepper" master (node 68:1172). Min 1 / max 30 seconds by default. */
export function DurationStepper({
  value,
  onChange,
  min = 1,
  max = 30,
  step: stepBy = 1,
  size = "md",
  label,
  className,
}: DurationStepperProps) {
  const t = useTranslations("sunday.dashboard");
  const tCommon = useTranslations("common");
  const config = SIZE_CONFIG[size];
  const atMin = value <= min;
  const atMax = value >= max;

  // Taps that land before the parent has re-rendered would otherwise all read the same
  // stale `value` prop and emit the same number, silently dropping steps. `emitted`
  // carries the last value this control emitted so consecutive taps compound, and
  // re-syncs to whatever the parent commits.
  const emitted = useRef(value);
  useEffect(() => {
    emitted.current = value;
  }, [value]);

  function step(delta: number) {
    const next = Math.min(max, Math.max(min, emitted.current + delta));
    if (next === emitted.current) return;
    emitted.current = next;
    onChange(next);
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label === false ? null : <p className={cn(config.label, "text-fg-secondary")}>{label ?? t("defaultSlideDuration")}</p>}
      <div className="flex items-center gap-3">
        <p className={cn(config.value, "font-bold text-fg")}>{tCommon("seconds", { count: value })}</p>
        <div className="flex items-center gap-2">
          <IconButton
            icon={Minus}
            size={config.button}
            variant="outlined"
            radius={10}
            aria-label={t("decreaseDuration")}
            disabled={atMin}
            onClick={() => step(-stepBy)}
          />
          <IconButton
            icon={Plus}
            size={config.button}
            variant="outlined"
            radius={10}
            aria-label={t("increaseDuration")}
            disabled={atMax}
            onClick={() => step(stepBy)}
          />
        </div>
      </div>
    </div>
  );
}
