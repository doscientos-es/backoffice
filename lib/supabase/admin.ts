import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. NEVER expose to the browser.
 * Use only inside Server Actions and route handlers that need
 * to bypass RLS (e.g. public portal endpoints, webhooks).
 */
export function createAdminClient() {
  const env = serverEnv();
  return createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-Client-Info": "backoffice-doscientos/admin" } },
  });
}
