import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

/** `/sunday/[date]/slide/[slideId]` → `/sunday/[date]?slide=<id>` (Step 2's inline edit panel). Old-route redirect stub. */
export default async function SlideRedirectPage({ params }: { params: Promise<{ date: string; slideId: string }> }) {
  const { date, slideId } = await params;
  const locale = await getLocale();
  redirect({ href: `/sunday/${date}?slide=${encodeURIComponent(slideId)}`, locale });
}
