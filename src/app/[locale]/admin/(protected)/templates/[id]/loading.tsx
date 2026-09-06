import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonStatus } from "@/components/ui/Skeleton";

/** Mirrors `StudioClient`: header + the field editor / canvas / assets three-column grid. */
export default function Loading() {
  return (
    <SkeletonStatus className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-10 w-24 rounded-md" />
          <Skeleton className="h-10 w-28 rounded-md" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_1fr_260px]">
        <div className="flex flex-col gap-5">
          <Card className="flex flex-col gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </Card>
        </div>

        <Card className="flex min-h-[500px] flex-col items-center justify-center gap-4">
          <Skeleton className="aspect-video w-full max-w-[640px] rounded-[12px]" />
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <Skeleton className="h-4 w-24" />
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full rounded-md" />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </SkeletonStatus>
  );
}
