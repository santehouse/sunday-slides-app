"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { signOut } from "@/lib/auth/admin-session";

/**
 * Server action for the Admin account-menu "Sign out" item — bind directly
 * with `<form action={signOutAction}>` (no `useActionState` needed, there's
 * no state to show: it always redirects to `/admin/sign-in`).
 */
export async function signOutAction(): Promise<void> {
  await signOut();
  const locale = await getLocale();
  redirect({ href: "/admin/sign-in", locale });
}
