import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/admin-session";

/**
 * Gate for every authenticated Admin screen (dashboard, sundays, templates,
 * assets, mappings, brand, settings, ...). Redirects to `/admin/sign-in`
 * when there's no valid admin session. New admin pages should be added
 * under this `(protected)` group so they inherit the gate — see
 * `admin/layout.tsx` for why `/admin/sign-in` lives outside it.
 */
export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return children;
}
