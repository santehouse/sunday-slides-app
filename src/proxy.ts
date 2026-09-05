import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/**
 * Locale routing only. Auth gating for /sunday and /admin lives in the
 * respective route-group layouts (server components) so the proxy stays thin.
 */
export default createMiddleware(routing);

export const config = {
  matcher: [
    "/((?!api|_next|_vercel|fonts|.*\\..*).*)",
  ],
};
