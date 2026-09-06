import { Spinner } from "@/components/ui/Spinner";
import { SkeletonStatus } from "@/components/ui/Skeleton";

/**
 * `/sunday` only resolves the current Sunday and redirects — there is nothing
 * worth ghosting, just a centered spinner for the instant before the redirect.
 */
export default function Loading() {
  return (
    <SkeletonStatus className="flex min-h-screen w-full items-center justify-center bg-canvas">
      <Spinner size={28} />
    </SkeletonStatus>
  );
}
