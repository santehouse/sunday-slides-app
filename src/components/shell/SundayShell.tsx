import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";

/**
 * Page container shared by every Sunday Team screen: App Header, then a
 * 28px gap before the page's own content (typically a SundayPageHeader).
 */
export function SundayShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[1312px] flex-col gap-7 px-4 pt-10 pb-16 md:px-16">
      <AppHeader />
      <main className="flex flex-1 flex-col gap-7">{children}</main>
    </div>
  );
}
