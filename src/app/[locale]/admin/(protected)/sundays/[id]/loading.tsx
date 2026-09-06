import { Card, CardHeader } from "@/components/ui/Card";
import { Skeleton, SkeletonStatus } from "@/components/ui/Skeleton";

/** Mirrors `SundayDetailPage`: header, slide count line, run sheets card. */
export default function Loading() {
  return (
    <SkeletonStatus className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>

      <Skeleton className="h-3.5 w-32" />

      <Card className="flex flex-col gap-4">
        <CardHeader title={<Skeleton className="h-5 w-28" />} />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-md" />
          ))}
        </div>
      </Card>
    </SkeletonStatus>
  );
}
