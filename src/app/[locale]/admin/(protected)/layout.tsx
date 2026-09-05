import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/admin-session";
import { signOutAction } from "../sign-out/actions";
import { AdminShell } from "@/components/shell/AdminShell";
import { ToastProvider } from "@/components/ui/Toast";
import { AdminLocaleSync } from "@/components/admin/AdminLocaleSync";

/**
 * Gate for every authenticated Admin screen (dashboard, sundays, templates,
 * assets, mappings, brand, settings, ...). Redirects to `/admin/sign-in`
 * when there's no valid admin session. New admin pages should be added
 * under this `(protected)` group so they inherit the gate — see
 * `admin/layout.tsx` for why `/admin/sign-in` lives outside it.
 */
export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdmin();

  return (
    <ToastProvider>
      <AdminLocaleSync />
      <AdminShell
        user={{
          displayName: session.adminUser.displayName,
          role: session.adminUser.role,
          locale: session.adminUser.locale,
        }}
        onSignOut={signOutAction}
      >
        {children}
      </AdminShell>
    </ToastProvider>
  );
}
