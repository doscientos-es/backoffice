import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";
import {
  USER_VERIFICATION_INTENTS,
  type UserVerificationIntent,
  type UserVerificationScope,
} from "./user-verification-scope";

/**
 * Explicit action scopes prevent a verification for one sensitive flow from
 * being replayed against a different operation. Add a scope before protecting
 * a new server action with `consumeUserVerification`.
 */
const VERIFICATION_COOKIE = "recent_user_verification";
const VERIFICATION_MAX_AGE_SECONDS = 5 * 60;

type VerificationGrant = {
  userId: string;
  intent: UserVerificationIntent;
  resource: string;
  expiresAt: number;
};

function sign(value: string): string {
  return createHmac("sha256", serverEnv().SUPABASE_SERVICE_ROLE_KEY)
    .update(`user-verification:${value}`)
    .digest("base64url");
}

function encode(grant: VerificationGrant): string {
  const value = Buffer.from(JSON.stringify(grant)).toString("base64url");
  return `${value}.${sign(value)}`;
}

function decode(cookieValue: string | undefined): VerificationGrant | null {
  if (!cookieValue) return null;
  const [value, signature] = cookieValue.split(".");
  if (!value || !signature) return null;

  const expected = Buffer.from(sign(value));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const grant = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as VerificationGrant;
    if (
      !USER_VERIFICATION_INTENTS.includes(grant.intent) ||
      !grant.userId ||
      typeof grant.resource !== "string" ||
      grant.resource.length === 0 ||
      !Number.isSafeInteger(grant.expiresAt) ||
      grant.expiresAt <= Date.now()
    ) {
      return null;
    }
    return grant;
  } catch {
    return null;
  }
}

/** Issue a short-lived, HTTP-only authorization after verified WebAuthn. */
export async function grantUserVerification(
  userId: string,
  scope: UserVerificationScope,
): Promise<void> {
  const store = await cookies();
  const grant: VerificationGrant = {
    userId,
    ...scope,
    expiresAt: Date.now() + VERIFICATION_MAX_AGE_SECONDS * 1000,
  };
  store.set(VERIFICATION_COOKIE, encode(grant), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: VERIFICATION_MAX_AGE_SECONDS,
  });
}

/** Validates and consumes a proof: one verification authorizes one action. */
export async function consumeUserVerification(
  userId: string,
  scope: UserVerificationScope,
): Promise<void> {
  const store = await cookies();
  const grant = decode(store.get(VERIFICATION_COOKIE)?.value);
  store.delete(VERIFICATION_COOKIE);

  if (
    !grant ||
    grant.userId !== userId ||
    grant.intent !== scope.intent ||
    grant.resource !== scope.resource
  ) {
    throw new Error("Confirma tu identidad con biometría o el bloqueo del dispositivo");
  }
}
