"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { IconButton } from "@/components/ui/IconButton";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { cn } from "@/lib/utils/cn";

export type AdminUser = {
  displayName: string;
  role: "owner" | "admin";
  locale: string;
};

export type AdminUserAccountProps = {
  user: AdminUser;
  onSignOut: () => void | Promise<void>;
  className?: string;
};

/** "en" -> "EN", "fr-CA" -> "FR" (matches the Language Selector's segment labels). */
function localeShortLabel(locale: string) {
  return locale.split("-")[0]!.toUpperCase();
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/** Bottom footer row of the Admin Nav: avatar, name/role, and an account menu. */
export function AdminUserAccount({ user, onSignOut, className }: AdminUserAccountProps) {
  const t = useTranslations("admin.nav");
  const tAuth = useTranslations("adminAuth");
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <div ref={wrapperRef} className={cn("relative flex h-14 items-center gap-2.5 px-2 py-1.5", className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[16px] border border-border bg-surface text-caption font-bold text-fg">
        {initials(user.displayName)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-[13px] font-bold text-fg">{user.displayName}</p>
        <p className="truncate text-[11px] text-fg-secondary">
          {t("roleLocale", { role: t(`roles.${user.role}`), locale: localeShortLabel(user.locale) })}
        </p>
      </div>
      <IconButton
        icon={MoreHorizontal}
        size={36}
        variant="ghost"
        aria-label={t("account")}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
      />
      {menuOpen ? (
        <div
          role="menu"
          className="absolute bottom-full left-0 mb-2 flex w-56 flex-col gap-3 rounded-lg border border-border bg-surface p-3 shadow-lg"
        >
          <div role="menuitem">
            <LanguageSelector size="sm" />
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              void onSignOut();
            }}
            className="rounded-md px-2 py-1.5 text-left text-label text-fg hover:bg-surface-subtle"
          >
            {tAuth("signOut")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
