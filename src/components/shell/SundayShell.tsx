import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";

/**
 * Page container shared by every Sunday Team screen: App Header, then a
 * 28px gap before the page's own content (typically a SundayPageHeader).
 *
 * The Figma canvas is 1440 wide with the 1312 content column starting at x=64 — the
 * 64px page padding sits *outside* that column, so the wrapper caps at 1440 (a 1312
 * cap made every Sunday screen 128px too narrow).
 */
export function SundayShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-7 px-4 pt-10 pb-16 md:px-16">
      <AppHeader />
      <main className="flex flex-1 flex-col gap-7">{children}</main>
    </div>
  );
}
