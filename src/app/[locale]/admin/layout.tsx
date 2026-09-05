import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";

/**
 * Thin wrapper for every `/admin/*` route. The actual auth gate lives in
 * the sibling `(protected)` route group (`admin/(protected)/layout.tsx`),
 * which wraps every admin screen EXCEPT `/admin/sign-in` — this mirrors the
 * `(sunday)` / `(sunday-public)` split for the PIN page, so `/admin/sign-in`
 * never redirects to itself. Route groups don't change the URL, only which
 * layout wraps a given leaf, so `/admin/sign-in` and everything under
 * `(protected)` both resolve as plain `/admin/...` paths.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return children;
}
