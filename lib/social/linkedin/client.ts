/**
 * Social Hub — shared LinkedIn REST client.
 *
 * Thin wrapper over api.linkedin.com/rest used by the LinkedIn publisher.
 * Mirrors the retry/timeout discipline of the Meta graph-client but speaks
 * LinkedIn's conventions: versioned header, Restli 2.0.0 protocol, JSON bodies,
 * and post ids returned in the `x-restli-id` response header (not the body).
 *
 * Auth today comes from LINKEDIN_ACCESS_TOKEN (env). When the OAuth "Connect
 * LinkedIn" flow lands, only linkedinToken() changes — callers stay untouched.
 */
import { serverEnv } from "@/lib/env";
import { scopedLogger } from "@/lib/logger";
import { PublishError } from "@/lib/social/core";

const log = scopedLogger("social-linkedin");

const REST_BASE = "https://api.linkedin.com/rest";
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 4;
const TRANSIENT_NET_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "ENETUNREACH",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
]);

function isTransientNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === "AbortError") return true;
  const cause = (err as { cause?: unknown }).cause;
  const code =
    (cause && typeof cause === "object" && "code" in cause
      ? (cause as { code?: unknown }).code
      : undefined) ?? (err as { code?: unknown }).code;
  return typeof code === "string" && TRANSIENT_NET_CODES.has(code);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** OAuth 2.0 access token. Empty when LinkedIn is not configured. */
export function linkedinToken(): string {
  return serverEnv().LINKEDIN_ACCESS_TOKEN ?? "";
}

/** Numeric organization id (urn:li:organization:<id>). Empty when unset. */
export function organizationId(): string {
  return serverEnv().LINKEDIN_ORGANIZATION_ID ?? "";
}

/** Fully-qualified author URN used on every post/comment as the company. */
export function authorUrn(): string {
  return `urn:li:organization:${organizationId()}`;
}

function versionedHeaders(extra: Record<string, string> = {}): HeadersInit {
  return {
    Authorization: `Bearer ${linkedinToken()}`,
    "LinkedIn-Version": serverEnv().LINKEDIN_API_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
    ...extra,
  };
}

async function requestWithRetry(url: string, init: RequestInit, attempt = 1): Promise<Response> {
  try {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if ((res.status >= 500 || res.status === 429) && attempt < MAX_ATTEMPTS) {
      const delay = 2 ** (attempt - 1) * 500 + Math.floor(Math.random() * 250);
      log.warn({ status: res.status, attempt, delay }, "LinkedIn transient HTTP, retrying");
      await sleep(delay);
      return requestWithRetry(url, init, attempt + 1);
    }
    return res;
  } catch (err) {
    if (isTransientNetworkError(err) && attempt < MAX_ATTEMPTS) {
      const delay = 2 ** (attempt - 1) * 500 + Math.floor(Math.random() * 250);
      log.warn({ err, attempt, delay }, "LinkedIn transient network error, retrying");
      await sleep(delay);
      return requestWithRetry(url, init, attempt + 1);
    }
    throw err;
  }
}

async function ensureOk(res: Response): Promise<void> {
  if (res.ok) return;
  const body = await res.text();
  let message = body.slice(0, 500);
  try {
    const parsed = JSON.parse(body) as { message?: string };
    if (parsed.message) message = parsed.message;
  } catch {
    /* keep raw body slice */
  }
  throw new PublishError("linkedin", `LinkedIn ${res.status}: ${message}`);
}

/** POST JSON to a REST resource, returning the created id from `x-restli-id`. */
export async function restPostForId(
  resource: string,
  body: unknown,
  params: Record<string, string> = {},
): Promise<string> {
  const url = new URL(`${REST_BASE}/${resource}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await requestWithRetry(url.toString(), {
    method: "POST",
    headers: versionedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(body),
  });
  await ensureOk(res);
  const id = res.headers.get("x-restli-id") ?? res.headers.get("x-linkedin-id");
  if (!id) throw new PublishError("linkedin", "LinkedIn no devolvió el id del recurso creado.");
  return id;
}

/** POST JSON expecting a JSON body back (e.g. initializeUpload actions). */
export async function restPostJson<T>(
  resource: string,
  body: unknown,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${REST_BASE}/${resource}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await requestWithRetry(url.toString(), {
    method: "POST",
    headers: versionedHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(body),
  });
  await ensureOk(res);
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

/** GET a REST resource as JSON. */
export async function restGet<T>(resource: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${REST_BASE}/${resource}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await requestWithRetry(url.toString(), { method: "GET", headers: versionedHeaders() });
  await ensureOk(res);
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

/** Stream binary bytes from a public URL to a LinkedIn upload URL (PUT). */
export async function uploadBinary(uploadUrl: string, sourceUrl: string): Promise<void> {
  const source = await fetch(sourceUrl, { cache: "no-store" });
  if (!source.ok) {
    throw new PublishError("linkedin", `No se pudo leer el media (${source.status}).`);
  }
  const bytes = await source.arrayBuffer();
  const res = await requestWithRetry(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${linkedinToken()}` },
    body: bytes,
  });
  await ensureOk(res);
}
