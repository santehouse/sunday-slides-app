import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * SSR Supabase client bound to the admin session cookie jar (Next 16's
 * `cookies()` is async). Use this for reading/writing the Supabase Auth
 * session in server components, layouts and server actions on the Admin
 * side. Never used by the Sunday team — that side never talks to Supabase.
 *
 * Throws if Supabase env vars are missing; callers must check
 * `hasSupabase()` / `isMockMode()` first.
 */
export async function createSupabaseServerClient() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase is not configured (missing NEXT_PUBLIC_SUPABASE_URL/ANON_KEY).");
  }
  const cookieStore = await cookies();

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component with no response to write to;
          // the middleware/session refresh elsewhere will still apply.
        }
      },
    },
  });
}
