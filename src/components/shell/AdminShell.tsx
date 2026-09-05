"use client";

import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/utils/cn";
import { AdminNav, type AdminNavProps } from "./AdminNav";

export type AdminShellProps = {
  user: AdminNavProps["user"];
  onSignOut: AdminNavProps["onSignOut"];
  children: ReactNode;
  /** "default" (px-12) for most Admin screens, "studio" (px-9) for Template Studio. */
  padding?: "default" | "studio";
};

const PADDING_CLASSES: Record<NonNullable<AdminShellProps["padding"]>, string> = {
  default: "px-12",
  studio: "px-9",
};

/** Admin layout: sticky AdminNav + main content. Collapses to a top bar below 1024px. */
export function AdminShell({ user, onSignOut, children, padding = "default" }: AdminShellProps) {
  const t = useTranslations("admin.nav");
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-canvas">
      <div className="hidden lg:flex">
        <AdminNav user={user} onSignOut={onSignOut} className="sticky top-0" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center border-b border-border bg-surface px-4 lg:hidden">
          <IconButton
            icon={mobileOpen ? X : Menu}
            variant="ghost"
            aria-label={t("menu")}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          />
        </div>

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div className="absolute inset-0 bg-overlay" onClick={() => setMobileOpen(false)} />
            <AdminNav
              user={user}
              onSignOut={onSignOut}
              className="relative z-10 h-screen"
            />
          </div>
        ) : null}

        <main className={cn("flex-1 min-w-0 py-12", PADDING_CLASSES[padding])}>{children}</main>
      </div>
    </div>
  );
}
