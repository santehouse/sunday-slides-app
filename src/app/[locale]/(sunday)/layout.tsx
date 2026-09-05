import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { requireSundaySession } from "@/lib/auth/sunday-session";

/**
 * Route-group gate for every Sunday-team screen (`/sunday`, `/sunday/[date]`,
 * `/sunday/[date]/flow`, etc). `/sunday/pin` deliberately lives OUTSIDE this
 * group — in the sibling `(sunday-public)` group — so it never redirects to
 * itself. Both groups resolve to plain `/sunday/...` URLs; Next.js route
 * groups don't affect the path, only which layout wraps a given leaf.
 */
export default async function SundayLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireSundaySession();

  return children;
}
