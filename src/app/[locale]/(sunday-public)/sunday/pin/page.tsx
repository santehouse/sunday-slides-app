import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/lib/data";
import { SundayShell } from "@/components/shell/SundayShell";
import { PinForm } from "./PinForm";

// Reads settings/session at request time — never prerender against the database at build.
export const dynamic = "force-dynamic";

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
    <SundayShell>
      <div className="flex flex-1 items-center justify-center py-12">
        <PinForm pinLength={settings.sundayPinLength} />
      </div>
    </SundayShell>
  );
}
