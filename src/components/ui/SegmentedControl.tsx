"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: ReactNode;
  "aria-label"?: string;
  /** Rendered but not selectable — e.g. Background/Image with no approved assets. */
  disabled?: boolean;
};

export type SegmentedControlSize = "sm" | "md" | "lg";
export type SegmentedControlVariant = "default" | "primary" | "solid";

export type SegmentedControlProps<T extends string> = {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the radiogroup as a whole. */
  ariaLabel: string;
  size?: SegmentedControlSize;
  variant?: SegmentedControlVariant;
  /** Segments stretch to fill the container evenly (used by LanguageSelector). */
  equalWidth?: boolean;
  className?: string;
};

// Exact px from the Figma "Language Selector" master (node 83:1135):
// SM container radius 12 / segment radius 8, MD container radius 14 / segment radius 10.
// `lg` is the Export Popover "Format Select" (node 52:694): h38 container / h30 segments.
const CONTAINER_SIZE: Record<SegmentedControlSize, string> = {
  sm: "h-8 rounded-[12px]",
  md: "h-10 rounded-[14px]",
  lg: "h-[38px] rounded-[8px]",
};

const SEGMENT_SIZE: Record<SegmentedControlSize, string> = {
  sm: "h-6 rounded-[8px] px-2.5 text-[13px]",
  md: "h-8 rounded-[10px] px-3 text-label",
  lg: "h-[30px] rounded-[6px] px-3 text-caption",
};

/**
 * Generic exclusive control backing the Background mode, Export format and
 * Language Selector patterns in Figma. `role="radiogroup"` of `role="radio"`
 * segments with roving focus and arrow-key navigation.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
  variant = "default",
  equalWidth = false,
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function focusAndSelect(index: number) {
    // Skip over disabled segments so arrow keys can never land on one.
    for (let step = 0; step < options.length; step++) {
      const wrapped = (index + step * Math.sign(index) + options.length * 2) % options.length;
      const option = options[wrapped];
      if (option && !option.disabled) {
        onChange(option.value);
        refs.current[wrapped]?.focus();
        return;
      }
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        focusAndSelect(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        focusAndSelect(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAndSelect(0);
        break;
      case "End":
        event.preventDefault();
        focusAndSelect(options.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "flex items-center gap-1 border border-border bg-surface-subtle p-1",
        CONTAINER_SIZE[size],
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option["aria-label"]}
            aria-disabled={option.disabled || undefined}
            disabled={option.disabled}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "flex items-center justify-center whitespace-nowrap font-bold transition-colors duration-[250ms]",
              "disabled:cursor-not-allowed disabled:opacity-50",
              SEGMENT_SIZE[size],
              equalWidth && "flex-1",
              selected
                ? variant === "default"
                  ? "border border-border bg-surface text-fg"
                  : "border border-primary bg-primary text-fg-on-primary"
                : variant === "solid"
                  ? "border border-border bg-surface text-fg"
                  : "border border-transparent text-fg-secondary",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
