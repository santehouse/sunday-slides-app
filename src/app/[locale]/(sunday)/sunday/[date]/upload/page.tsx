import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

/** `/sunday/[date]/upload` → `/sunday/[date]/run-sheet` (Step 1). Old-route redirect stub. */
export default async function UploadRedirectPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const locale = await getLocale();
  redirect({ href: `/sunday/${date}/run-sheet`, locale });
}
