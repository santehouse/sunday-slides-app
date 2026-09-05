import { cn } from "@/lib/utils/cn";

export type FilterChipOption = { value: string; label: string };

export type FilterChipsProps = {
  options: FilterChipOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  "aria-label"?: string;
};

/** Single-select filter chip row (Add Slide / Template Library / Asset Library). */
export function FilterChips({ options, value, onChange, className, ...rest }: FilterChipsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} role="group" aria-label={rest["aria-label"]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-7 shrink-0 rounded-full px-3 text-caption font-bold transition-colors",
              active ? "bg-primary text-fg-on-primary" : "bg-surface-subtle text-fg-secondary hover:bg-border",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
