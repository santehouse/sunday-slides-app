import { SundayShell } from "@/components/shell/SundayShell";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonStatus } from "@/components/ui/Skeleton";

/** Mirrors `UploadClient`: the dropzone column + the run-sheet preview panel. */
export default function Loading() {
  return (
    <SundayShell>
      <SkeletonStatus className="flex flex-1 flex-col gap-7">
        <div className="flex min-h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-6 w-6" />
            <Skeleton className="h-[30px] w-52" />
          </div>
          <Skeleton className="h-10 w-24 rounded-md" />
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
