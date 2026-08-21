"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { UserVerificationScope } from "@/lib/security/user-verification-scope";
import {
  completePasskeyAuthentication,
  preparePasskeyAuthentication,
} from "@/lib/security/webauthn-client";

type VerificationResult = { ok: true } | { ok: false; error: string };
type PendingVerification = {
  options: unknown;
  resolve: (result: VerificationResult) => void;
  scope: UserVerificationScope;
};

/**
 * Prepares a server challenge, then starts the device authenticator from an
 * explicit second click so browsers retain the required user activation.
 */
export function usePasskeyVerification() {
  const [pending, setPending] = useState<PendingVerification | null>(null);
  const [completing, setCompleting] = useState(false);

  async function verifyWithPasskey(scope: UserVerificationScope): Promise<VerificationResult> {
    const started = await preparePasskeyAuthentication(scope);
    if (!started.ok) return started;

    return new Promise((resolve) => {
      setPending({ options: started.options, resolve, scope });
    });
  }

  async function confirm() {
    if (!pending) return;

    setCompleting(true);
    const verification = await completePasskeyAuthentication(pending.scope, pending.options);
    setCompleting(false);
    setPending(null);
    pending.resolve(verification);
  }

  function close() {
    if (!pending || completing) return;
    const { resolve } = pending;
    setPending(null);
    resolve({ ok: false, error: "La verificación se ha cancelado" });
  }

  const challenge = (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent showCloseButton={!completing}>
        <DialogHeader>
          <DialogTitle>Confirmar identidad</DialogTitle>
          <DialogDescription>
            Usa el método de autenticación disponible en este dispositivo para continuar.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" disabled={completing} onClick={close}>
            Cancelar
          </Button>
          <Button disabled={completing} onClick={confirm}>
            Confirmar con biometría
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { challenge, verifyWithPasskey };
}
