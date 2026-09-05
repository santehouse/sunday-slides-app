import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Service-role Supabase client — bypasses RLS. Server-only, used by
 * `src/lib/data/supabaseDb.ts` and `scripts/seed.ts` after the Sunday
 * session cookie or Admin auth session has already been validated
 * upstream. NEVER import this from a client component or expose the key
 * via `NEXT_PUBLIC_*`.
 */
let client: ReturnType<typeof createClient<Database>> | null = null;

export function getServiceClient() {
  if (client) return client;
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase service role is not configured (missing URL or SUPABASE_SERVICE_ROLE_KEY).");
  }
  client = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
