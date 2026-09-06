import type { ReactNode } from "react";

/**
 * App Router `template.tsx` re-mounts on every navigation (unlike `layout.tsx`,
 * which persists) — this is what lets every route transition play a fresh
 * 250ms soft fade/rise (product-owner request) without any client-side
 * navigation-tracking code.
 */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="flex min-h-full flex-1 flex-col cp-page-enter">{children}</div>;
}
