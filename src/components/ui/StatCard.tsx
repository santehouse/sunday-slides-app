import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Card } from "./Card";

export type StatCardProps = {
  value?: ReactNode;
  label?: ReactNode;
  /** Custom content instead of value/label (e.g. hosting the Duration Stepper). */
  children?: ReactNode;
  className?: string;
};

/** Figma metrics-row card: Arimo Bold 26 value + 12px secondary label. */
export function StatCard({ value, label, children, className }: StatCardProps) {
  return (
    <Card padding="md" className={cn("flex flex-col justify-center gap-1", className)}>
      {children ?? (
        <>
          <p className="text-[26px] font-bold leading-none text-fg">{value}</p>
          <p className="text-caption text-fg-secondary">{label}</p>
        </>
      )}
    </Card>
  );
}
