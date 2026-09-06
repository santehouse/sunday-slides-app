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
        <div className="grid grid-cols-2 gap-[18px]">
          <Card padding="none" className="flex flex-col gap-3 p-6">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-10 w-40 rounded-md" />
          </Card>
          <Card padding="none" className="flex flex-col gap-3 p-6">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-10 w-40 rounded-md" />
          </Card>
        </div>
        <Skeleton className="h-16 w-full rounded-lg" />
      </SkeletonStatus>
    </SundayShell>
  );
}
