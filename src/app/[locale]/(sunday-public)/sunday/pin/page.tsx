import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/lib/data";
import { PinForm } from "./PinForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pin" });
  return { title: t("title") };
}

/**
 * `/sunday/pin` — the only ungated Sunday-team screen. Lives in the
 * `(sunday-public)` route group (see `(sunday)/layout.tsx` for why).
 */
export default async function SundayPinPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const settings = await getDb().getSettings();

  return (
    <main className="flex min-h-dvh flex-col">
      {/* TODO(ui-kit): swap to <AppHeader /> once src/components/shell/AppHeader exists */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="text-label font-bold">Church Panels</span>
        {/* TODO(ui-kit): swap to <LanguageSelector /> once src/components/ui/LanguageSelector exists */}
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <PinForm pinLength={settings.sundayPinLength} />
      </div>
    </main>
  );
}
