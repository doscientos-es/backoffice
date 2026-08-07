import "server-only";

import { publicEnv, serverEnv } from "@/lib/env";
import { createServerClient } from "@/lib/supabase/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { grantUserVerification } from "./user-verification";
import type { UserVerificationScope } from "./user-verification-scope";

const CHALLENGE_COOKIE = "webauthn_challenge";
const CHALLENGE_MAX_AGE_SECONDS = 5 * 60;
const TRANSPORTS = ["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"] as const;

type ChallengeKind = "registration" | "authentication";
type Challenge = {
  challenge: string;
  userId: string;
  kind: ChallengeKind;
  scope?: UserVerificationScope;
  expiresAt: number;
};
type WebAuthnUser = { id: string; email: string; name: string };
type CredentialRow = {
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string[] | null;
};

function config() {
  const appUrl = new URL(publicEnv.NEXT_PUBLIC_APP_URL);
  return { expectedOrigin: appUrl.origin, rpID: appUrl.hostname, rpName: "Doscientos" };
}

function sign(value: string): string {
  return createHmac("sha256", serverEnv().SUPABASE_SERVICE_ROLE_KEY)
    .update(`webauthn-challenge:${value}`)
    .digest("base64url");
}

function encode(challenge: Challenge): string {
  const value = Buffer.from(JSON.stringify(challenge)).toString("base64url");
  return `${value}.${sign(value)}`;
}

function decode(cookieValue: string | undefined): Challenge | null {
  if (!cookieValue) return null;
  const [value, signature] = cookieValue.split(".");
  if (!value || !signature) return null;

  const expected = Buffer.from(sign(value));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const challenge = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Challenge;
    if (
      !challenge.userId ||
      !challenge.challenge ||
      !["registration", "authentication"].includes(challenge.kind) ||
      !Number.isSafeInteger(challenge.expiresAt) ||
      challenge.expiresAt <= Date.now()
    ) {
      return null;
    }
    return challenge;
  } catch {
    return null;
  }
}

async function storeChallenge(challenge: Challenge): Promise<void> {
  const store = await cookies();
  store.set(CHALLENGE_COOKIE, encode(challenge), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: CHALLENGE_MAX_AGE_SECONDS,
  });
}

async function consumeChallenge(userId: string, kind: ChallengeKind): Promise<Challenge> {
  const store = await cookies();
  const challenge = decode(store.get(CHALLENGE_COOKIE)?.value);
  store.delete(CHALLENGE_COOKIE);

  if (!challenge || challenge.userId !== userId || challenge.kind !== kind) {
    throw new Error("La verificación ha caducado. Inténtalo de nuevo.");
  }
  return challenge;
}

function validTransports(transports: string[] | null): AuthenticatorTransportFuture[] | undefined {
  if (!transports) return undefined;
  const result = transports.filter((value): value is AuthenticatorTransportFuture =>
    TRANSPORTS.includes(value as (typeof TRANSPORTS)[number]),
  );
  return result.length > 0 ? result : undefined;
}

async function credentialsFor(userId: string): Promise<CredentialRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("webauthn_credentials")
    .select("credential_id, public_key, counter, transports")
    .eq("user_id", userId);
  if (error) throw new Error("No se han podido consultar las credenciales biométricas");
  return (data as CredentialRow[] | null) ?? [];
}

/** Returns whether the current user has at least one registered passkey. */
export async function hasRegisteredPasskey(userId: string): Promise<boolean> {
  const supabase = await createServerClient();
  const { count, error } = await supabase
    .from("webauthn_credentials")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw new Error("No se han podido consultar las credenciales biométricas");
  return (count ?? 0) > 0;
}

/** Creates an attestation challenge after the caller has applied its enrollment policy. */
export async function createPasskeyRegistrationOptions(user: WebAuthnUser) {
  const { rpID, rpName } = config();
  const existing = await credentialsFor(user.id);
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    timeout: CHALLENGE_MAX_AGE_SECONDS * 1000,
    excludeCredentials: existing.map((credential) => ({
      id: credential.credential_id,
      transports: validTransports(credential.transports),
    })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  await storeChallenge({
    challenge: options.challenge,
    userId: user.id,
    kind: "registration",
    expiresAt: Date.now() + CHALLENGE_MAX_AGE_SECONDS * 1000,
  });
  return options;
}

/** Validates and persists the public part of a newly registered passkey. */
export async function verifyPasskeyRegistration(
  userId: string,
  response: RegistrationResponseJSON,
): Promise<void> {
  const challenge = await consumeChallenge(userId, "registration");
  const { expectedOrigin, rpID } = config();
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin,
    expectedRPID: rpID,
    requireUserVerification: true,
  });
  if (!verification.verified || !verification.registrationInfo?.userVerified) {
    throw new Error("No se ha podido verificar la biometría o el bloqueo del dispositivo");
  }

  const { credential, credentialBackedUp, credentialDeviceType } = verification.registrationInfo;
  const supabase = await createServerClient();
  const { error } = await supabase.from("webauthn_credentials").insert({
    user_id: userId,
    credential_id: credential.id,
    public_key: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: response.response.transports ?? [],
    device_type: credentialDeviceType,
    backed_up: credentialBackedUp,
  });
  if (error) throw new Error("No se ha podido guardar la credencial biométrica");
}

/** Creates an assertion challenge restricted to the current user's passkeys. */
export async function createPasskeyAuthenticationOptions(
  userId: string,
  scope: UserVerificationScope,
) {
  const { rpID } = config();
  const existing = await credentialsFor(userId);
  if (existing.length === 0) throw new Error("No tienes biometría configurada en esta cuenta");

  const options = await generateAuthenticationOptions({
    rpID,
    timeout: CHALLENGE_MAX_AGE_SECONDS * 1000,
    userVerification: "required",
    allowCredentials: existing.map((credential) => ({
      id: credential.credential_id,
      transports: validTransports(credential.transports),
    })),
  });
  await storeChallenge({
    challenge: options.challenge,
    userId,
    kind: "authentication",
    scope,
    expiresAt: Date.now() + CHALLENGE_MAX_AGE_SECONDS * 1000,
  });
  return options;
}

/** Verifies an assertion, advances its signature counter, and grants one scoped proof. */
export async function verifyPasskeyAuthentication(
  userId: string,
  scope: UserVerificationScope,
  response: AuthenticationResponseJSON,
): Promise<void> {
  const challenge = await consumeChallenge(userId, "authentication");
  if (challenge.scope?.intent !== scope.intent || challenge.scope.resource !== scope.resource) {
    throw new Error("La verificación no corresponde a esta acción");
  }

  const credential = (await credentialsFor(userId)).find(
    (candidate) => candidate.credential_id === response.id,
  );
  if (!credential) throw new Error("La credencial biométrica no está autorizada");

  const { expectedOrigin, rpID } = config();
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin,
    expectedRPID: rpID,
    requireUserVerification: true,
    credential: {
      id: credential.credential_id,
      publicKey: new Uint8Array(Buffer.from(credential.public_key, "base64url")),
      counter: credential.counter,
      transports: validTransports(credential.transports),
    },
  });
  if (!verification.verified || !verification.authenticationInfo.userVerified) {
    throw new Error("No se ha podido verificar la biometría o el bloqueo del dispositivo");
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("webauthn_credentials")
    .update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("credential_id", credential.credential_id);
  if (error) throw new Error("No se ha podido actualizar la credencial biométrica");

  await grantUserVerification(userId, scope);
}
