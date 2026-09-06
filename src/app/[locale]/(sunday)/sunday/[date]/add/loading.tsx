import { SundayShell } from "@/components/shell/SundayShell";
import { Skeleton, SkeletonCard, SkeletonStatus } from "@/components/ui/Skeleton";

/** Mirrors `AddSlidePage`: breadcrumb + header, category chip row + an 8-card template grid ghost. */
export default function Loading() {
  return (
    <SundayShell>
      <SkeletonStatus className="flex flex-1 flex-col gap-7">
        <Skeleton className="h-3.5 w-64" />
        <div className="flex min-h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-6 w-6" />
            <Skeleton className="h-[30px] w-40" />
          </div>
          <Skeleton className="h-10 w-24 rounded-md" />
        </div>
        <Skeleton className="h-3 w-72" />
        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-24 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </SkeletonStatus>
    </SundayShell>
  );
}
