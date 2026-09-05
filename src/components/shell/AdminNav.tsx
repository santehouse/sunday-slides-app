"use client";

import { Calendar, FileText, Image as ImageIcon, Images, Link2, Type, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { AdminUserAccount, type AdminUser } from "./AdminUserAccount";

type NavItem = { href: string; icon: LucideIcon; labelKey: string };

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", icon: Calendar, labelKey: "dashboard" },
  { href: "/admin/sundays", icon: FileText, labelKey: "sundays" },
  { href: "/admin/templates", icon: ImageIcon, labelKey: "templates" },
  { href: "/admin/assets", icon: Images, labelKey: "assets" },
  { href: "/admin/mappings", icon: Link2, labelKey: "mappings" },
  { href: "/admin/brand", icon: Type, labelKey: "brand" },
  { href: "/admin/settings", icon: Settings, labelKey: "settings" },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type AdminNavProps = {
  user: AdminUser;
  onSignOut: () => void | Promise<void>;
  className?: string;
};

/** Figma "Admin Nav" master (node 68:1637). Sticky left sidebar for every Admin route. */
export function AdminNav({ user, onSignOut, className }: AdminNavProps) {
  const t = useTranslations("admin.nav");
  const brand = useTranslations("brand");
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "flex h-screen w-[260px] shrink-0 flex-col gap-3 border-r border-border bg-surface px-5 pb-5 pt-7",
        className,
      )}
    >
      <Link href="/admin" className="flex h-8 shrink-0 items-center gap-2.5">
        <span aria-hidden="true" className="size-7 shrink-0 rounded-[7px] bg-primary" />
        <span className="whitespace-nowrap text-body font-bold text-fg">{brand("name")}</span>
      </Link>
      <ul className="flex flex-col gap-1.5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // min-h, not a fixed height: the longer fr-CA labels wrap instead of clipping.
                  "flex min-h-[42px] items-center gap-2.5 rounded-[8px] px-3 py-1.5 text-label",
                  active ? "bg-surface-subtle font-bold text-fg" : "font-normal text-fg-secondary hover:bg-surface-subtle",
                )}
              >
                <Icon aria-hidden="true" size={20} className="shrink-0" />
                <span>{t(item.labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="flex-1" />
      <AdminUserAccount user={user} onSignOut={onSignOut} />
    </nav>
  );
}
