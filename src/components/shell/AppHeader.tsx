import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSelector } from "@/components/ui/LanguageSelector";

/** Figma "App Header" master (node 87:418). Sits at the top of every Sunday-side page. */
export function AppHeader() {
  const t = useTranslations("sunday.header");
  const brand = useTranslations("brand");

  return (
    <header className="flex h-12 w-full items-center justify-between gap-4">
      <Link href="/sunday" aria-label={t("brandHome")} className="flex shrink-0 items-center gap-2.5">
        <span aria-hidden="true" className="size-7 rounded-[8px] bg-primary" />
        <span className="whitespace-nowrap text-body font-bold text-fg">{brand("name")}</span>
      </Link>
      <LanguageSelector size="sm" />
    </header>
  );
}
