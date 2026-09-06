import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonStatus } from "@/components/ui/Skeleton";

/** Mirrors `MappingsClient`: header, info banner, mappings table. */
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
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
      </div>

      <Skeleton className="h-16 w-full rounded-lg" />

      <Card padding="none" className="overflow-hidden p-5">
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-[10px]" />
          ))}
        </div>
      </Card>
    </SkeletonStatus>
  );
}
