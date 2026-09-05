import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Padding in px, defaults to the Figma spec (20px / p-5). */
  padding?: "none" | "sm" | "md";
};

const PADDING_CLASSES: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
};

/** Figma card surface: bg-surface, 1px border, radius 14 (rounded-lg). */
export function Card({ padding = "md", className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface",
        PADDING_CLASSES[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export type CardHeaderProps = {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
};

/** Title (h3) + optional right-aligned action slot, used at the top of a Card. */
export function CardHeader({ title, action, className }: CardHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h3 className="text-h3 font-bold text-fg">{title}</h3>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
