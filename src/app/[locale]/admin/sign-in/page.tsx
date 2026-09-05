import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SignInForm } from "./SignInForm";

// Reads settings/session at request time — never prerender against the database at build.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "adminAuth" });
  return { title: t("title") };
}

/** `/admin/sign-in` — deliberately outside the `(protected)` group; see admin/layout.tsx. */
export default async function AdminSignInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "adminAuth" });
  const tBrand = await getTranslations({ locale, namespace: "brand" });

  return (
    <div className="flex min-h-dvh bg-canvas">
      {/* Figma 7:302 — top-aligned, 72px padding, 20px gaps, white 42px rounded mark. */}
      <aside className="hidden w-[650px] shrink-0 flex-col items-start gap-5 bg-primary p-[72px] text-fg-on-primary lg:flex">
        <span aria-hidden="true" className="size-[42px] shrink-0 rounded-[12px] bg-fg-on-primary" />
        <span className="text-h1 font-bold">{tBrand("name")}</span>
        <h1 className="max-w-[480px] text-[28px] font-bold leading-[1.25]">{t("heroTitle")}</h1>
        <p className="max-w-[470px] text-[15px] leading-[22px]">{t("heroBody")}</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <SignInForm />
      </main>
    </div>
  );
}
