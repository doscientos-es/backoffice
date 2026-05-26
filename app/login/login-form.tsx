"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") ?? "/inicio";
  const urlError = search.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Stale auth cookies (e.g. session without a team_members row) would loop
  // the user back here forever. Clear them so the next login is clean.
  useEffect(() => {
    if (!urlError || urlError === "no_session") return;
    void getBrowserClient().auth.signOut();
  }, [urlError]);

  const displayedError = useMemo(
    () => formError ?? (urlError ? authFailureMessage(urlError) : null),
    [formError, urlError],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    const supabase = getBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) {
      setFormError(friendlyError(authError.message));
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <FieldGroup>
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
                aria-invalid={displayedError ? true : undefined}
                aria-describedby={displayedError ? "login-error" : undefined}
                disabled={loading}
              />
            </Field>
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="password" className="text-xs font-medium">
                  Contraseña <span className="text-destructive">*</span>
                </FieldLabel>
                <Link
                  href="/login/forgot-password"
                  className="text-xs text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] hover:underline underline-offset-2"
                  tabIndex={loading ? -1 : 0}
                >
                  ¿La olvidaste?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={displayedError ? true : undefined}
                  aria-describedby={displayedError ? "login-error" : undefined}
                  disabled={loading}
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] disabled:pointer-events-none"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
            </Field>
          </FieldGroup>
          {displayedError ? (
            <p
              id="login-error"
              role="alert"
              className={cn(
                "rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs",
                "text-destructive",
              )}
            >
              {displayedError}
            </p>
          ) : null}
          <Button type="submit" disabled={loading || !email || !password} className="mt-1">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Entrando…
              </>
            ) : (
              "Entrar"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function friendlyError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "Tu email aún no está confirmado.";
  if (m.includes("rate limit")) return "Demasiados intentos. Inténtalo en unos minutos.";
  return raw;
}

function authFailureMessage(reason: string): string {
  switch (reason) {
    case "no_team_member":
      return "Tu cuenta no está autorizada en este workspace. Contacta con un administrador para que te dé acceso.";
    case "team_member_deleted":
      return "Tu acceso ha sido revocado. Contacta con un administrador si crees que es un error.";
    case "db_error":
      return "No se pudo verificar tu acceso. Inténtalo de nuevo en unos segundos.";
    case "forbidden":
      return "No tienes permisos para esa sección.";
    default:
      return "Sesión expirada. Vuelve a entrar.";
  }
}
