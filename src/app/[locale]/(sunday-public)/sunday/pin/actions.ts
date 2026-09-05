"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { PinError, verifyPinAndCreateSession } from "@/lib/auth/sunday-session";

export interface PinFormState {
  error: "invalid" | "rate_limited" | "not_configured" | "incomplete" | null;
}

export const initialPinFormState: PinFormState = { error: null };

function clientIp(headerList: Awaited<ReturnType<typeof headers>>): string {
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return headerList.get("x-real-ip") ?? "unknown";
}

/** Server action bound to the PIN form: verifies the PIN, sets the session cookie, redirects to `/sunday`. */
export async function submitPin(_prevState: PinFormState, formData: FormData): Promise<PinFormState> {
  const pin = String(formData.get("pin") ?? "").trim();
  if (!pin) {
    return { error: "incomplete" };
  }

  const headerList = await headers();
  const ip = clientIp(headerList);

  try {
    await verifyPinAndCreateSession(pin, ip);
  } catch (error) {
    if (error instanceof PinError) {
      return { error: error.code };
    }
    throw error;
  }

  const locale = await getLocale();
  return redirect({ href: "/sunday", locale });
}
