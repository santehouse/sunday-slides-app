import { Skeleton, SkeletonStatus } from "@/components/ui/Skeleton";
import { SundayShell } from "@/components/shell/SundayShell";

/** Mirrors the queue screen: title row + export button, action row, review strip, queue rows + preview panel. */
export default function Loading() {
  return (
    <SundayShell>
      <SkeletonStatus className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-10 w-28 rounded-md" />
        </div>

        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-28 rounded-md" />
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-10 w-44 rounded-md" />
            <Skeleton className="h-10 w-32 rounded-md" />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-6 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] w-full rounded-[12px]" />
            ))}
          </div>
          <Skeleton className="h-[280px] w-full shrink-0 rounded-lg lg:w-[420px]" />
        </div>
      </SkeletonStatus>
    </SundayShell>
  );
}
