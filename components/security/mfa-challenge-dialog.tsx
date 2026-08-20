"use client";

import { CircleNotch as Loader2, ShieldCheckIcon as ShieldCheck } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getBrowserClient } from "@/lib/supabase/browser";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; onVerified: () => void };

export function MfaChallengeDialog({ open, onOpenChange, onVerified }: Props) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCode("");
    setError(null);
    setLoading(true);
    void getBrowserClient()
      .auth.mfa.listFactors()
      .then(({ data, error: factorsError }) => {
        const factor = data?.totp.find((candidate) => candidate.status === "verified");
        setFactorId(factor?.id ?? null);
        if (factorsError || !factor) {
          setError("No hay una aplicación Authenticator configurada para esta cuenta.");
        }
      })
      .finally(() => setLoading(false));
  }, [open]);

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId) return;
    setError(null);
    setLoading(true);
    const { error: verifyError } = await getBrowserClient().auth.mfa.challengeAndVerify({
      factorId,
      code: code.replaceAll(" ", ""),
    });
    setLoading(false);
    if (verifyError) {
      setError("El código no es válido. Comprueba la hora de tu dispositivo e inténtalo de nuevo.");
      return;
    }
    onVerified();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" /> Confirmar acción
          </DialogTitle>
          <DialogDescription>
            Introduce el código de seis dígitos de Google Authenticator para continuar. No saldrás
            de esta página.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={verify} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="invoice-mfa-code">Código de verificación</FieldLabel>
            <Input
              id="invoice-mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value)}
              disabled={loading || !factorId}
              required
            />
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !factorId || code.replaceAll(" ", "").length < 6}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : null} Verificar y continuar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
