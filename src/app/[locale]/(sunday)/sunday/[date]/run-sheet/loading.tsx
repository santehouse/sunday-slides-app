import { SundayShell } from "@/components/shell/SundayShell";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonStatus } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <SundayShell>
      <SkeletonStatus className="flex flex-1 flex-col gap-5">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-3 gap-3.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        <Card padding="none" className="flex flex-col gap-3.5 p-[22px]">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-28 w-full rounded-lg" />
        </Card>
        <Card padding="none" className="flex flex-col gap-2.5 p-[22px]">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </Card>
      </SkeletonStatus>
    </SundayShell>
  );
}
