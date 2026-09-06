import { Card, CardHeader } from "@/components/ui/Card";
import { Skeleton, SkeletonStatus } from "@/components/ui/Skeleton";

/** Mirrors `SettingsClient`: header + a two-column grid of settings-section cards. */
export default function Loading() {
  return (
    <SkeletonStatus className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-72" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="flex flex-col gap-4">
            <CardHeader title={<Skeleton className="h-5 w-32" />} />
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-10 w-full rounded-md" />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </SkeletonStatus>
  );
}
