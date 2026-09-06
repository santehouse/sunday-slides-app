import type { HTMLAttributes } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { Card } from "./Card";
import { VisuallyHidden } from "./VisuallyHidden";

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

/**
 * A single ghost block. Purely decorative (`aria-hidden`) — pair it with a
 * `role="status"` + translated `common.loading` label somewhere in the tree
 * (see `SkeletonStatus` below, used by every `loading.tsx`).
 */
export function Skeleton({ className, ...rest }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-[8px] bg-surface-subtle", className)}
      {...rest}
    />
  );
}

export type SkeletonTextProps = {
  /** Number of ghost lines. */
  lines?: number;
  /** Width of the last line (the rest are full width), e.g. "60%". */
  lastLineWidth?: string;
  className?: string;
};

/** A short paragraph's worth of ghost lines. */
export function SkeletonText({ lines = 2, lastLineWidth = "70%", className }: SkeletonTextProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className="h-3 w-full"
          style={index === lines - 1 && lines > 1 ? { width: lastLineWidth } : undefined}
        />
      ))}
    </div>
  );
}

export type SkeletonCardProps = {
  className?: string;
};

/** A Card-shaped ghost: a thumbnail block plus two lines of text, matching Template/Slide Flow cards. */
export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <Card padding="sm" className={cn("flex flex-col gap-3", className)}>
      <Skeleton className="aspect-video w-full rounded-[10px]" />
      <Skeleton className="h-3.5 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </Card>
  );
}

/**
 * Wraps `role="status"` and the visually-hidden translated `common.loading`
 * label that every ghost screen needs, around otherwise-decorative skeleton
 * markup. Renders `children` (the ghost shapes) followed by the label.
 */
export function SkeletonStatus({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  const t = useTranslations("common");
  return (
    <div role="status" className={className} {...rest}>
      {children}
      <VisuallyHidden>{t("loading")}</VisuallyHidden>
    </div>
  );
}
