import { NextResponse, type NextRequest } from "next/server";
import { getPathname } from "@/i18n/navigation";
import { routing, isAppLocale } from "@/i18n/routing";
import { hasSupabase } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Supabase Auth callback for the Admin magic-link flow: exchanges the
 * `code` query param for a session (setting the Supabase cookies via
 * `createSupabaseServerClient`'s cookie adapter), then redirects to
 * `/admin` in whichever locale the visitor's `cp_locale` cookie says.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code && hasSupabase()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const localeCookieName =
    typeof routing.localeCookie === "object" && routing.localeCookie.name ? routing.localeCookie.name : "cp_locale";
  const cookieLocale = request.cookies.get(localeCookieName)?.value ?? "";
  const locale = isAppLocale(cookieLocale) ? cookieLocale : routing.defaultLocale;
  const path = getPathname({ href: "/admin", locale });

  return NextResponse.redirect(new URL(path, origin));
}
