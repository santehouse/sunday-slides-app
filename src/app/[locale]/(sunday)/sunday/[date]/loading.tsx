import { SundayShell } from "@/components/shell/SundayShell";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonStatus } from "@/components/ui/Skeleton";

/** Mirrors `CheckSlidesPage`: stepper header, checklist card, slide list + preview/edit panel. */
export default function Loading() {
  return (
    <SundayShell>
      <SkeletonStatus className="flex flex-1 flex-col gap-5">
        <div className="flex flex-col gap-3.5">
          <Skeleton className="h-8 w-72" />
          <div className="grid grid-cols-3 gap-3.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3.5">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <Skeleton className="h-24 w-full rounded-md" />

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
            <Skeleton className="aspect-video w-full max-w-[640px] rounded-[10px]" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </Card>
        </div>
      </SkeletonStatus>
    </SundayShell>
  );
}
