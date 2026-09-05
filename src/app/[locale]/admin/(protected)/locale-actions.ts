"use server";

import { updateCurrentAdminLocale } from "@/lib/auth/admin-session";
import type { Locale } from "@/lib/domain/types";

/**
 * Persists the signed-in admin's locale preference whenever they switch
 * languages anywhere under `/admin` — bound to `<AdminLocaleSync>` (see
 * `src/components/admin/AdminLocaleSync.tsx`), mounted once in the
 * `(protected)` layout. The `LanguageSelector` inside `AdminUserAccount`
 * (a shell component) already switches the URL/locale cookie itself; this
 * only adds the "remember it on the account" side effect.
 */
export async function syncAdminLocaleAction(locale: Locale): Promise<void> {
  await updateCurrentAdminLocale(locale);
}
