import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { Card } from "./Card";

export type StatCardProps = {
  value?: ReactNode;
  label?: ReactNode;
  /** Custom content instead of value/label (e.g. hosting the Duration Stepper). */
  children?: ReactNode;
  className?: string;
  /** Makes the card a link (e.g. "Needs review" → Flow with the flagged slide selected). */
  href?: ComponentPropsWithoutRef<typeof Link>["href"];
};

/** Figma metrics-row card: Arimo Bold 26 value + 12px secondary label. */
export function StatCard({ value, label, children, className, href }: StatCardProps) {
  const content = children ?? (
    <>
      <p className="text-[26px] font-bold leading-none text-fg">{value}</p>
      <p className="text-caption text-fg-secondary">{label}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "flex flex-col justify-center gap-1 rounded-lg border border-border bg-surface p-5 transition-colors duration-[250ms] hover:bg-surface-subtle",
          className,
        )}
      >
        {content}
      </Link>
    );
  }

  return (
    <Card padding="md" className={cn("flex flex-col justify-center gap-1", className)}>
      {content}
    </Card>
  );
}
