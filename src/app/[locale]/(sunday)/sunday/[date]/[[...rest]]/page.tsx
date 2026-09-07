import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

/**
 * Every old per-date Sunday route (`/sunday/[date]`, `/sunday/[date]/flow`,
 * `/sunday/[date]/run-sheet`, `/sunday/[date]/download`, `/sunday/[date]/add`,
 * `/sunday/[date]/upload`, `/sunday/[date]/run-sheet/previous`,
 * `/sunday/[date]/slide/[slideId]`) collapses into the single `/sunday` queue screen —
 * this catch-all keeps old bookmarks/email links working, preserving `?slide=` (and
 * opening the matching modal) wherever the old route implied one.
 */
export default async function LegacySundayRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string; rest?: string[] }>;
  searchParams: Promise<{ slide?: string; add?: string }>;
}) {
  const { rest } = await params;
  const { slide, add } = await searchParams;
  const locale = await getLocale();
  const segments = rest ?? [];

  let query = "";
  if (segments[0] === "slide" && segments[1]) {
    query = `?slide=${encodeURIComponent(segments[1])}`;
  } else if (segments[0] === "add") {
    query = "?add=1";
  } else if (segments[0] === "run-sheet" || segments[0] === "upload") {
    query = "?import=1";
  } else if (slide) {
    query = `?slide=${encodeURIComponent(slide)}`;
  } else if (add === "1") {
    query = "?add=1";
  }

  redirect({ href: `/sunday${query}`, locale });
}
