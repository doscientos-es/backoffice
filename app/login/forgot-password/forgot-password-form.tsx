"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { publicEnv } from "@/lib/env";
import { getBrowserClient } from "@/lib/supabase/browser";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

function friendlyError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("rate limit")) return "Demasiados intentos. Inténtalo en unos minutos.";
  if (m.includes("invalid")) return "Email no válido.";
  return raw;
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const hcaptchaRef = useRef<HCaptcha>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (publicEnv.NEXT_PUBLIC_HCAPTCHA_SITE_KEY && !captchaToken) {
      setError("Por favor, completa el captcha.");
      return;
    }
    setLoading(true);
    const supabase = getBrowserClient();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/login/update-password")}`,
      captchaToken: captchaToken ?? undefined,
    });
    setLoading(false);
    if (authError) {
      setError(friendlyError(authError.message));
      hcaptchaRef.current?.resetCaptcha();
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="h-8 w-8 text-[color:var(--success)]" aria-hidden />
            <div>
              <p className="text-sm font-medium text-primary">Revisa tu bandeja de entrada</p>
              <p className="mt-1 text-xs text-muted">
                Si <strong>{email}</strong> está registrado, te hemos enviado un enlace para
                restablecer tu contraseña.
              </p>
            </div>
            <Link
              href="/login"
              className="mt-2 inline-flex items-center gap-1 text-xs text-muted hover:text-primary hover:underline underline-offset-2"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden /> Volver al login
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field>
            <FieldLabel htmlFor="email" className="text-xs font-medium">
              Email <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              required
              placeholder="tu@doscientos.es"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "forgot-error" : "forgot-hint"}
              disabled={loading}
            />
            <FieldDescription id="forgot-hint">
              Te enviaremos un enlace para restablecer la contraseña.
            </FieldDescription>
          </Field>
          {error ? (
            <p
              id="forgot-error"
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </p>
          ) : null}
          {publicEnv.NEXT_PUBLIC_HCAPTCHA_SITE_KEY && (
            <div className="flex justify-center">
              <HCaptcha
                ref={hcaptchaRef}
                sitekey={publicEnv.NEXT_PUBLIC_HCAPTCHA_SITE_KEY}
                onVerify={(token) => setCaptchaToken(token)}
                onExpire={() => setCaptchaToken(null)}
              />
            </div>
          )}
          <Button type="submit" disabled={loading || !email}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Enviando…
              </>
            ) : (
              "Enviar enlace"
            )}
          </Button>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-1 text-xs text-muted hover:text-primary hover:underline underline-offset-2"
            tabIndex={loading ? -1 : 0}
          >
            <ArrowLeft className="h-3 w-3" aria-hidden /> Volver al login
          </Link>
        </form>
      </CardContent>
    </Card>
  );
}
