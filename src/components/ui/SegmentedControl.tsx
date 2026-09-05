"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: ReactNode;
  "aria-label"?: string;
};

export type SegmentedControlSize = "sm" | "md";
export type SegmentedControlVariant = "default" | "primary";

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

const CONTAINER_SIZE: Record<SegmentedControlSize, string> = {
  sm: "h-8 rounded-md",
  md: "h-10 rounded-lg",
};

const SEGMENT_SIZE: Record<SegmentedControlSize, string> = {
  sm: "h-6 rounded-sm px-2.5 text-[13px]",
  md: "h-8 rounded-md px-3 text-label",
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
    const wrapped = (index + options.length) % options.length;
    const option = options[wrapped];
    if (!option) return;
    onChange(option.value);
    refs.current[wrapped]?.focus();
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
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "flex items-center justify-center whitespace-nowrap font-bold transition-colors",
              SEGMENT_SIZE[size],
              equalWidth && "flex-1",
              selected
                ? variant === "primary"
                  ? "bg-primary text-fg-on-primary"
                  : "border border-border bg-surface text-fg"
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
