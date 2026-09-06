import { SundayShell } from "@/components/shell/SundayShell";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonStatus } from "@/components/ui/Skeleton";

/** Mirrors `UploadRunSheetPage`: header + week switcher, tabs, the dropzone column + the run-sheet preview panel. */
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

        <div className="flex h-10 items-end gap-6 border-b border-border pb-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>

        <div className="grid grid-cols-[620px_minmax(0,1fr)] gap-[18px]">
          <Card padding="none" className="flex min-h-[820px] flex-col gap-3.5 p-[22px]">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-64" />
            <Skeleton className="h-[280px] w-full rounded-[14px]" />
          </Card>

          <Card padding="none" className="flex min-h-[820px] flex-col gap-3.5 p-[22px]">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-56" />
            <div className="flex w-full flex-col gap-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-[10px]" />
              ))}
            </div>
          </Card>
        </div>
      </SkeletonStatus>
    </SundayShell>
  );
}
