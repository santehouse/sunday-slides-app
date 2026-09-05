import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SignInForm } from "./SignInForm";

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
    <div className="flex min-h-dvh">
      <aside className="hidden w-[650px] flex-col justify-center gap-5 bg-[var(--bg-primary)] px-16 text-[var(--text-on-primary)] lg:flex">
        <span className="text-lg font-bold">{tBrand("name")}</span>
        <h1 className="text-4xl font-bold leading-tight">{t("heroTitle")}</h1>
        <p className="text-base opacity-90">{t("heroBody")}</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <SignInForm />
      </main>
    </div>
  );
}
