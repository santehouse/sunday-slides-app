"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
};

/**
 * Figma "Toggle" master (node 3:74) — `role="switch"` with the label as part
 * of the single clickable control.
 */
export function Toggle({ checked, onChange, label, description, disabled, className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-start gap-2.5 text-left disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors duration-[250ms]",
          checked ? "bg-primary" : "bg-border-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white transition-transform duration-[250ms]",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-label text-fg">{label}</span>
        {description ? <span className="text-caption text-fg-secondary">{description}</span> : null}
      </span>
    </button>
  );
}
