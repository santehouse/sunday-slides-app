"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils/cn";

export type PopoverProps = {
  trigger: (props: { open: boolean; toggle: () => void; "aria-expanded": boolean; "aria-haspopup": "dialog"; id: string }) => ReactNode;
  children: (props: { close: () => void }) => ReactNode;
  className?: string;
  panelClassName?: string;
  align?: "start" | "end";
};

/**
 * Anchored floating panel (Figma "Export Popover"). No portal/positioning
 * library — the panel is `position: absolute` within a `relative` wrapper,
 * anchored below the trigger. Focus returns to the trigger whenever the
 * panel transitions from open to closed, regardless of what closed it.
 */
export function Popover({ trigger, children, className, panelClassName, align = "end" }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  const triggerId = useId();

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  // Outside click / Escape close the panel.
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) close();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, close]);

  // Return focus to the trigger on every open -> closed transition.
  useEffect(() => {
    if (wasOpenRef.current && !open) {
      wrapperRef.current?.querySelector<HTMLElement>(`#${CSS.escape(triggerId)}`)?.focus();
    }
    wasOpenRef.current = open;
  }, [open, triggerId]);

  return (
    <div ref={wrapperRef} className={cn("relative inline-block", className)}>
      {trigger({
        open,
        toggle,
        "aria-expanded": open,
        "aria-haspopup": "dialog",
        id: triggerId,
      })}
      {open ? (
        <div
          role="dialog"
          className={cn(
            "absolute top-full z-30 mt-2 rounded-lg border border-border bg-surface p-5 shadow-lg",
            align === "end" ? "right-0" : "left-0",
            panelClassName,
          )}
        >
          {children({ close })}
        </div>
      ) : null}
    </div>
  );
}
