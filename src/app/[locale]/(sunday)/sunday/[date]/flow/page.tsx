import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

/**
 * `/sunday/[date]/flow` → `/sunday/[date]` (Step 2, "Check slides", now the default
 * screen). Kept as a redirect so old bookmarks and email links still work; preserves
 * `?slide=` so a deep link into a specific slide still lands on it.
 */
export default async function FlowRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ slide?: string }>;
}) {
  const { date } = await params;
  const { slide } = await searchParams;
  const locale = await getLocale();
  const query = slide ? `?slide=${encodeURIComponent(slide)}` : "";
  redirect({ href: `/sunday/${date}${query}`, locale });
}
