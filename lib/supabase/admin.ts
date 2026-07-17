import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env";
import { createClient } from "@supabase/supabase-js";

type GenerateAuthLinkOptions = {
  type: "invite" | "recovery" | "magiclink" | "signup";
  email: string;
  data?: Record<string, unknown>;
  redirectTo?: string;
};

type GeneratedAuthLink = {
  user: { id: string } | null;
  properties: { hashed_token: string } | null;
};

/**
 * Calls GoTrue directly because the installed JS client does not expose
 * auth.admin.generateLink, while self-hosted Supabase still supports the
 * official /auth/v1/admin/generate_link endpoint.
 */
export async function generateAuthLink(
  options: GenerateAuthLinkOptions,
): Promise<{ data: GeneratedAuthLink | null; error: { message: string; status?: number } | null }> {
  const env = serverEnv();
  const response = await fetch(
    `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/generate_link`,
    {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: options.type,
        email: options.email,
        data: options.data,
        redirect_to: options.redirectTo,
      }),
      cache: "no-store",
    },
  );

  const payload = (await response.json().catch(() => null)) as
    | {
        user?: { id: string } | null;
        hashed_token?: string;
        properties?: { hashed_token?: string };
      }
    | { msg?: string; message?: string }
    | null;

  if (!response.ok) {
    const errorPayload = payload as { msg?: string; message?: string } | null;
    return {
      data: null,
      error: {
        message:
          errorPayload?.msg ?? errorPayload?.message ?? `Supabase Auth error (${response.status})`,
        status: response.status,
      },
    };
  }

  const successPayload = payload as {
    id?: string;
    user?: { id: string } | null;
    hashed_token?: string;
    properties?: { hashed_token?: string };
  } | null;
  const hashedToken =
    successPayload?.properties?.hashed_token ?? successPayload?.hashed_token ?? null;
  const userId = successPayload?.user?.id ?? successPayload?.id ?? null;
  return {
    data: {
      user: userId ? { id: userId } : null,
      properties: hashedToken ? { hashed_token: hashedToken } : null,
    },
    error: null,
  };
}

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
