import { SundayShell } from "@/components/shell/SundayShell";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonStatus } from "@/components/ui/Skeleton";

/** Mirrors `EditorClient`: a 420px form column of field ghosts + a preview ghost. */
export default function Loading() {
  return (
    <SundayShell>
      <SkeletonStatus className="flex flex-1 flex-col gap-[22px]">
        <div className="flex min-h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-6 w-6" />
            <Skeleton className="h-6 w-48" />
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <Skeleton className="h-10 w-28 rounded-md" />
            <Skeleton className="h-10 w-36 rounded-md" />
          </div>
        </div>

        <div className="grid grid-cols-[420px_1fr] gap-5">
          <Card padding="none" className="flex min-h-[850px] w-full flex-col gap-3.5 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ))}
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full rounded-md" />
              ))}
            </div>
          </Card>

          <Card padding="none" className="flex min-h-[850px] flex-col gap-3.5 p-5">
            <div className="flex h-10 items-center justify-between gap-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-32 rounded-md" />
            </div>
            <Skeleton className="h-[590px] w-full rounded-[12px]" />
          </Card>
        </div>
      </SkeletonStatus>
    </SundayShell>
  );
}
