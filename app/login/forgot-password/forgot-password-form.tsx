"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getBrowserClient } from "@/lib/supabase/browser";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = getBrowserClient();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    // Route through /auth/callback so the recovery code is exchanged into a
    // fresh session (after signing out any pre-existing one) before the user
    // lands on the update-password form. Otherwise a stale cookie session in
    // the same browser would be the one whose password gets rewritten.
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/login/update-password")}`,
    });
    setLoading(false);
    if (authError) {
      setError(friendlyError(authError.message));
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
