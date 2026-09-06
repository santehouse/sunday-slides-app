import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

/** `/sunday/[date]/add` → `/sunday/[date]?add=1` (Step 2's inline template picker). Old-route redirect stub. */
export default async function AddRedirectPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const locale = await getLocale();
  redirect({ href: `/sunday/${date}?add=1`, locale });
}
