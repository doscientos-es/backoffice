import { isDemoMode } from "@/lib/demo";
import { serverEnv } from "@/lib/env";
import { PublishError } from "@/lib/social/core";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_BASE = "https://mybusiness.googleapis.com/v4";
const SCOPE = "https://www.googleapis.com/auth/business.manage";

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

export function googleBusinessRedirectUri(): string {
  const env = serverEnv();
  return (
    env.GOOGLE_BUSINESS_REDIRECT_URI ||
    `${env.NEXT_PUBLIC_APP_URL}/api/social/google-business/callback`
  );
}

export function googleBusinessProfileConfigured(): boolean {
  const env = serverEnv();
  return Boolean(
    env.GOOGLE_BUSINESS_CLIENT_ID &&
      env.GOOGLE_BUSINESS_CLIENT_SECRET &&
      env.GOOGLE_BUSINESS_REFRESH_TOKEN &&
      env.GOOGLE_BUSINESS_ACCOUNT_ID &&
      env.GOOGLE_BUSINESS_LOCATION_ID,
  );
}

export function googleBusinessOAuthConfigured(): boolean {
  const env = serverEnv();
  return Boolean(env.GOOGLE_BUSINESS_CLIENT_ID && env.GOOGLE_BUSINESS_CLIENT_SECRET);
}

export function googleBusinessAccountId(): string {
  return serverEnv().GOOGLE_BUSINESS_ACCOUNT_ID.replace(/^accounts\//, "");
}

export function googleBusinessLocationId(): string {
  return serverEnv().GOOGLE_BUSINESS_LOCATION_ID.replace(/^locations\//, "");
}

export function googleBusinessLanguageCode(): string {
  return serverEnv().GOOGLE_BUSINESS_LANGUAGE_CODE;
}

export function googleBusinessAuthorizationUrl(state: string): string {
  const env = serverEnv();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.GOOGLE_BUSINESS_CLIENT_ID);
  url.searchParams.set("redirect_uri", googleBusinessRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeGoogleBusinessCode(code: string): Promise<GoogleTokenResponse> {
  const env = serverEnv();
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_BUSINESS_CLIENT_ID,
    client_secret: env.GOOGLE_BUSINESS_CLIENT_SECRET,
    redirect_uri: googleBusinessRedirectUri(),
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as GoogleTokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.refresh_token) {
    throw new Error(data.error_description ?? data.error ?? `Google OAuth devolvió ${res.status}.`);
  }
  return data;
}

async function accessToken(): Promise<string> {
  const env = serverEnv();
  const body = new URLSearchParams({
    client_id: env.GOOGLE_BUSINESS_CLIENT_ID,
    client_secret: env.GOOGLE_BUSINESS_CLIENT_SECRET,
    refresh_token: env.GOOGLE_BUSINESS_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as GoogleTokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new PublishError(
      "google_business_profile",
      data.error_description ?? data.error ?? `Google OAuth devolvió ${res.status}.`,
    );
  }
  return data.access_token;
}

export async function googleBusinessRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (isDemoMode()) {
    throw new PublishError(
      "google_business_profile",
      "Google Business Profile está desactivado en modo demo.",
    );
  }
  const token = await accessToken();
  const res = await fetch(`${API_BASE}/${path.replace(/^\//, "")}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text.slice(0, 500);
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      message = parsed.error?.message ?? message;
    } catch {
      /* Keep the bounded raw response. */
    }
    throw new PublishError(
      "google_business_profile",
      `Google Business Profile ${res.status}: ${message}`,
    );
  }
  return (text ? JSON.parse(text) : {}) as T;
}
