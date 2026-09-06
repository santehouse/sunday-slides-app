import { SundayShell } from "@/components/shell/SundayShell";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonStatus } from "@/components/ui/Skeleton";

/** Mirrors `SundayFlowPage`: header + week switcher, tabs, action row, flow list (8 card ghosts) + a 16:9 preview ghost. */
export default function Loading() {
  return (
    <SundayShell>
      <SkeletonStatus className="flex flex-1 flex-col gap-7">
        <div className="flex min-h-[59px] items-center justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-3.5 w-96" />
          </div>
          <Skeleton className="h-12 w-[220px] rounded-[12px]" />
        </div>

        <div className="flex h-10 items-end gap-6 border-b border-border pb-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>

        <div className="flex justify-end gap-2.5">
          <Skeleton className="h-10 w-36 rounded-md" />
          <Skeleton className="h-10 w-28 rounded-md" />
          <Skeleton className="h-10 w-24 rounded-md" />
        </div>

        <div className="grid grid-cols-[500px_1fr] gap-[18px]">
          <Card padding="none" className="flex min-h-[820px] flex-col gap-2.5 p-[18px]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex h-[88px] items-center gap-2.5 rounded-[12px] border border-border bg-surface px-3">
                <Skeleton className="h-6 w-6 shrink-0" />
                <Skeleton className="h-[50px] w-[88px] shrink-0 rounded-[6px]" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
              </div>
            ))}
          </Card>

          <Card padding="none" className="flex min-h-[820px] flex-col gap-3.5 p-[18px]">
            <div className="flex h-10 items-center justify-between gap-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-9 w-32 rounded-md" />
            </div>
            <Skeleton className="aspect-video w-full max-w-[758px] rounded-[12px]" />
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-10 w-32 rounded-md" />
              <Skeleton className="h-10 w-36 rounded-md" />
            </div>
          </Card>
        </div>
      </SkeletonStatus>
    </SundayShell>
  );
}
