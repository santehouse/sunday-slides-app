import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";

export type SafeZonesActionProps = {
  active: boolean;
  onToggle: () => void;
  className?: string;
};

/** Figma "Safe Zones Action" master (node 58:25). Preview-only visibility toggle. */
export function SafeZonesAction({ active, onToggle, className }: SafeZonesActionProps) {
  const t = useTranslations("sunday.safeZones");
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 rounded-md px-2.5 text-label font-bold text-fg hover:bg-surface-subtle",
        className,
      )}
    >
      <Eye aria-hidden="true" size={20} />
      {active ? t("hide") : t("show")}
    </button>
  );
}
