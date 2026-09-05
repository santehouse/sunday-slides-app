import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * Anon browser client — used only by the Admin sign-in page for
 * password/magic-link auth calls that must run client-side. Reads the two
 * public env vars directly (safe: anon key is meant for the browser).
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase is not configured for the browser client.");
  }
  return createBrowserClient<Database>(url, anonKey);
}
