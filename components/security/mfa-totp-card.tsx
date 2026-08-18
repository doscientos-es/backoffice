"use client";

import { Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getBrowserClient } from "@/lib/supabase/browser";

type Props = { required: boolean };
type Enrollment = { id: string; qrCode: string };

export function MfaTotpCard({ required }: Props) {
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [challengeFactorId, setChallengeFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const supabase = getBrowserClient();
      const [factorsResult, assuranceResult] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      if (factorsResult.error || assuranceResult.error) {
        setError("No se pudo consultar el estado de MFA.");
      }
      const factor = factorsResult.data?.totp.find((candidate) => candidate.status === "verified");
      setVerified(Boolean(factor));
      if (factor && assuranceResult.data?.currentLevel !== "aal2") setChallengeFactorId(factor.id);
      setLoading(false);
    })();
  }, []);

  async function startEnrollment() {
    setError(null);
    setLoading(true);
    const supabase = getBrowserClient();
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator app",
      issuer: "Doscientos Backoffice",
    });
    if (error || !data?.totp?.qr_code) {
      setError("No se pudo iniciar la configuración de MFA.");
      setLoading(false);
      return;
    }
    setEnrollment({ id: data.id, qrCode: data.totp.qr_code });
    setLoading(false);
  }

  async function verifyEnrollment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const factorId = enrollment?.id ?? challengeFactorId;
    if (!factorId) return;
    setError(null);
    setLoading(true);
    const { error } = await getBrowserClient().auth.mfa.challengeAndVerify({
      factorId,
      code: code.replaceAll(" ", ""),
    });
    if (error) {
      setError("El código no es válido. Comprueba la hora de tu dispositivo e inténtalo de nuevo.");
      setLoading(false);
      return;
    }
    setVerified(true);
    setEnrollment(null);
    setCode("");
    setLoading(false);
    window.location.reload();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              {verified ? <ShieldCheck className="size-5" /> : <Smartphone className="size-5" />}
            </div>
            <div>
              <CardTitle>Verificación en dos pasos</CardTitle>
              <CardDescription>
                {required
                  ? "Obligatoria para administrar el backoffice."
                  : "Protege tu cuenta con un código de tu aplicación autenticadora."}
              </CardDescription>
            </div>
          </div>
          <Badge variant={verified ? "success" : "neutral"}>
            {verified ? "Activa" : "Pendiente"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {enrollment ? (
          <form onSubmit={verifyEnrollment} className="flex max-w-sm flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Escanea el código con tu aplicación autenticadora y confirma el código de seis
              dígitos.
            </p>
            {/* The QR is a short-lived data URI returned by Supabase, not a remote image Next can optimize. */}
            {/* biome-ignore lint/performance/noImgElement: TOTP QR data URI must remain client-local. */}
            <img
              src={enrollment.qrCode}
              alt="Código QR para configurar MFA"
              className="size-44 rounded-md border bg-white p-2"
            />
            <Field>
              <FieldLabel htmlFor="mfa-code">Código de verificación</FieldLabel>
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
              />
            </Field>
            <Button type="submit" disabled={loading || code.length < 6}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : null} Verificar y activar
            </Button>
          </form>
        ) : challengeFactorId ? (
          <form onSubmit={verifyEnrollment} className="flex max-w-sm flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Introduce el código de tu aplicación autenticadora para desbloquear las áreas de
              administración.
            </p>
            <Field>
              <FieldLabel htmlFor="mfa-code">Código de verificación</FieldLabel>
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
              />
            </Field>
            <Button type="submit" disabled={loading || code.length < 6}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : null} Verificar acceso
            </Button>
          </form>
        ) : verified ? (
          <p className="text-sm text-muted-foreground">
            Tu próxima sesión requerirá un código además de tu acceso habitual.
          </p>
        ) : (
          <Button type="button" className="w-fit" onClick={startEnrollment} disabled={loading}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Smartphone className="size-4" />
            )}{" "}
            Configurar MFA
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
