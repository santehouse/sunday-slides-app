"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type ApprovedColor = { id: string; name: string; hex: string };

export type ColorSelectProps = {
  options: ApprovedColor[];
  value: string | null;
  onChange: (id: string) => void;
  /** Accessible name for the control (there is no visible <label> in the Figma master). */
  "aria-label": string;
  className?: string;
  disabled?: boolean;
};

/**
 * Figma "Color Select" master (node 58:26) — an admin-approved color picker
 * implemented as a small accessible listbox (Radix isn't installed).
 */
export function ColorSelect({
  options,
  value,
  onChange,
  className,
  disabled,
  ...rest
}: ColorSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();
  const ariaLabel = rest["aria-label"];

  const selected = options.find((option) => option.id === value) ?? null;

  function openList() {
    const optionIndex = options.findIndex((option) => option.id === value);
    setActiveIndex(optionIndex >= 0 ? optionIndex : 0);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
      el?.focus();
    }
  }, [open, activeIndex]);

  function commit(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.id);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((i) => (i + 1) % options.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((i) => (i - 1 + options.length) % options.length);
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(activeIndex);
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        break;
    }
  }

  return (
    <div className={cn("relative inline-block w-60", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            openList();
          }
        }}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface py-2 pl-3 pr-2.5",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected ? (
            <span
              className="size-4 shrink-0 rounded-[4px]"
              style={{ backgroundColor: selected.hex }}
              aria-hidden="true"
            />
          ) : null}
          <span className="truncate text-label font-bold text-fg">
            {selected ? selected.name : ""}
          </span>
        </span>
        <ChevronDown aria-hidden="true" size={20} className="shrink-0 text-fg-muted" />
      </button>
      {open ? (
        <ul
          ref={listRef}
          role="listbox"
          id={listboxId}
          aria-label={ariaLabel}
          tabIndex={-1}
          onKeyDown={handleListKeyDown}
          className="absolute left-0 top-full z-20 mt-1 max-h-64 w-full min-w-[200px] overflow-auto rounded-md border border-border bg-surface p-1 shadow-lg"
        >
          {options.map((option, index) => {
            const isSelected = option.id === value;
            return (
              <li
                key={option.id}
                role="option"
                aria-selected={isSelected}
                data-index={index}
                tabIndex={index === activeIndex ? 0 : -1}
                onClick={() => commit(index)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-label text-fg outline-none",
                  index === activeIndex && "bg-surface-subtle",
                )}
              >
                <span
                  className="size-4 shrink-0 rounded-[4px]"
                  style={{ backgroundColor: option.hex }}
                  aria-hidden="true"
                />
                <span className="flex-1 truncate">{option.name}</span>
                {isSelected ? <Check aria-hidden="true" size={16} /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
