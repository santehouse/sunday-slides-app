import { Card, CardHeader } from "@/components/ui/Card";
import { Skeleton, SkeletonStatus } from "@/components/ui/Skeleton";

/** Mirrors `AdminDashboardPage`: header, 4 stat cards, upcoming Sunday + system health cards. */
export default function Loading() {
  return (
    <SkeletonStatus className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-3 w-72" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-40 rounded-md" />
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} padding="md" className="h-[120px]">
            <Skeleton className="mb-2 h-6 w-20" />
            <Skeleton className="h-3 w-28" />
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_376px]">
        <Card className="flex flex-col gap-5">
          <CardHeader title={<Skeleton className="h-5 w-40" />} />
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[58px] w-full rounded-[10px]" />
            ))}
          </div>
          <Skeleton className="h-10 w-40 rounded-md" />
        </Card>

        <Card className="flex flex-col gap-3">
          <CardHeader title={<Skeleton className="h-5 w-32" />} />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[58px] w-full" />
            ))}
          </div>
        </Card>
      </div>
    </SkeletonStatus>
  );
}
