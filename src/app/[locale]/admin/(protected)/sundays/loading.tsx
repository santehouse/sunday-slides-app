import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonStatus } from "@/components/ui/Skeleton";

/** Mirrors `SundaysClient`: header + the Sundays table (5 row ghosts). */
export default function Loading() {
  return (
    <SkeletonStatus className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-3 w-72" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-40 rounded-md" />
          <Skeleton className="h-10 w-36 rounded-md" />
        </div>
      </div>

      <Card padding="none" className="overflow-hidden p-5">
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] w-full rounded-[10px]" />
          ))}
        </div>
      </Card>
    </SkeletonStatus>
  );
}
