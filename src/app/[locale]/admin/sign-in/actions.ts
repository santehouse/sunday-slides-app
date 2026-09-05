"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { appUrl } from "@/lib/env";
import { sendMagicLink, signInWithPassword } from "@/lib/auth/admin-session";

export type SignInFormState =
  | { mode: "idle" }
  | { mode: "invalid_credentials" }
  | { mode: "magic_link_sent"; email: string }
  | { mode: "magic_link_error" };

export const initialSignInFormState: SignInFormState = { mode: "idle" };

/**
 * Single action backing both buttons on the sign-in form — the submit
 * button that triggered submission sets `intent` via its own `name`/`value`,
 * which FormData includes automatically.
 */
export async function signInFormAction(_prev: SignInFormState, formData: FormData): Promise<SignInFormState> {
  const intent = String(formData.get("intent") ?? "password");
  const email = String(formData.get("email") ?? "").trim();

  if (intent === "magic-link") {
    if (!email) return { mode: "invalid_credentials" };
    const result = await sendMagicLink(email, `${appUrl()}/api/auth/callback`);
    if (!result.ok) return { mode: "magic_link_error" };
    return { mode: "magic_link_sent", email };
  }

  const password = String(formData.get("password") ?? "");
  const result = await signInWithPassword(email, password);
  if (!result.ok) return { mode: "invalid_credentials" };

  const locale = await getLocale();
  return redirect({ href: "/admin", locale });
}
