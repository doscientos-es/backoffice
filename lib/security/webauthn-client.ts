"use client";

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type { UserVerificationScope } from "./user-verification-scope";
import {
  beginPasskeyAuthentication,
  finishPasskeyAuthentication,
  finishPasskeyRegistration,
} from "./webauthn-actions";

type Result = { ok: true } | { ok: false; error: string };

function unavailable(): Result | null {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return { ok: false, error: "Este navegador no permite biometría ni passkeys" };
  }
  return null;
}

function browserError(error: unknown): Result {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return { ok: false, error: "La verificación se ha cancelado o ha caducado" };
  }
  return { ok: false, error: "No se ha podido completar la verificación biométrica" };
}

/** Runs a complete, server-verified WebAuthn step-up flow for one explicit intent. */
export async function verifyWithPasskey(scope: UserVerificationScope): Promise<Result> {
  const supportError = unavailable();
  if (supportError) return supportError;

  const started = await beginPasskeyAuthentication(scope);
  if (!started.ok) return started;
  try {
    const response = await startAuthentication({ optionsJSON: started.options as never });
    return await finishPasskeyAuthentication(scope, response);
  } catch (error) {
    return browserError(error);
  }
}

/** Completes a registration flow after its feature has obtained registration options. */
export async function registerPasskey(options: unknown): Promise<Result> {
  const supportError = unavailable();
  if (supportError) return supportError;

  try {
    const response = await startRegistration({ optionsJSON: options as never });
    return await finishPasskeyRegistration(response);
  } catch (error) {
    return browserError(error);
  }
}
