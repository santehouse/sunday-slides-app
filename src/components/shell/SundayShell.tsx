import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";

/**
 * Page container shared by every Sunday Team screen: App Header, then a
 * 28px gap before the page's own content (typically a SundayPageHeader).
 *
 * Wider than the 1440 Figma canvas on purpose (QA: "make the whole platform wider"):
 * the queue and preview split the width 50/50, so the wrapper caps at 1760 with a
 * 32px gutter instead of the Figma 64px.
 */
export function SundayShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-7 px-4 pt-10 pb-16 md:px-8">
      <AppHeader />
      <main className="flex flex-1 flex-col gap-7">{children}</main>
    </div>
  );
}
