import { publicEnv } from "@/lib/env";
import { createServerClient as createSSRClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server Component / Server Action / Route Handler Supabase client.
 * Uses the user's session cookies (RLS enforced).
 */
export async function createServerClient() {
  const cookieStore = await cookies();
  return createSSRClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Read-only contexts (Server Components) ignore set; refresh handled by proxy.ts
          }
        },
      },
    },
  );
}
