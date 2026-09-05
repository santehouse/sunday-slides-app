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
      <aside className="hidden w-[650px] shrink-0 flex-col justify-center gap-5 bg-primary px-16 text-fg-on-primary lg:flex">
        <span aria-hidden="true" className="size-[42px] rounded-xl bg-white/15" />
        <span className="text-h1 font-bold">{tBrand("name")}</span>
        <h1 className="text-[40px] font-bold leading-tight">{t("heroTitle")}</h1>
        <p className="max-w-[420px] text-body text-fg-on-primary/85">{t("heroBody")}</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <SignInForm />
      </main>
    </div>
  );
}
