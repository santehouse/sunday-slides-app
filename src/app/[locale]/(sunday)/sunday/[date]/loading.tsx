import { SundayShell } from "@/components/shell/SundayShell";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonStatus } from "@/components/ui/Skeleton";

/** Mirrors `SundayDashboardPage`: title bar + week switcher, 4 stat cards, flow + run sheet panels. */
export default function Loading() {
  return (
    <SundayShell>
      <SkeletonStatus className="flex flex-1 flex-col gap-7">
        <div className="flex min-h-[59px] items-center justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-3.5 w-80" />
          </div>
          <Skeleton className="h-12 w-[220px] rounded-[12px]" />
        </div>

        <div className="grid grid-cols-4 gap-3.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} padding="md" className="h-[108px]">
              <Skeleton className="mb-2 h-6 w-16" />
              <Skeleton className="h-3 w-24" />
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-[1fr_424px] gap-[18px]">
          <Card padding="none" className="flex flex-col gap-2.5 p-[22px]">
            <div className="flex h-10 items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-10 w-28 rounded-md" />
            </div>
            <div className="flex flex-col gap-2.5">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex h-[68px] items-center gap-2.5 rounded-[10px] bg-surface-subtle px-3.5">
                  <Skeleton className="h-4 w-4 shrink-0 bg-border" />
                  <Skeleton className="h-[45px] w-20 shrink-0 rounded-[6px] bg-border" />
                  <Skeleton className="h-3.5 flex-1 bg-border" />
                  <Skeleton className="h-5 w-16 shrink-0 rounded-full bg-border" />
                </div>
              ))}
            </div>
          </Card>

          <Card padding="none" className="flex flex-col items-start gap-3.5 p-[22px]">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-10 w-40 rounded-md" />
          </Card>
        </div>
      </SkeletonStatus>
    </SundayShell>
  );
}
