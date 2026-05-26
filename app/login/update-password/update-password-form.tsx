"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordStrength } from "@/components/ui/password-strength";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const MIN_LENGTH = 8;

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    const supabase = getBrowserClient();
    const { error: authError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    router.replace("/inicio");
    router.refresh();
  }

  if (hasSession === false) {
    return (
      <Card>
        <CardContent className="pt-5">
          <p className="text-sm text-[color:var(--text-muted)]">
            El enlace ha caducado o no es válido.{" "}
            <a
              href="/login/forgot-password"
              className="font-medium text-[color:var(--text-primary)] hover:underline underline-offset-2"
            >
              Solicita uno nuevo
            </a>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" className="text-xs font-medium">
              Nueva contraseña <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                autoFocus
                required
                minLength={MIN_LENGTH}
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby="password-hint"
                disabled={loading}
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                tabIndex={-1}
                aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={show}
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
                disabled={loading}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <PasswordStrength value={password} />
            <p id="password-hint" className="text-[11px] text-muted-foreground">
              Mínimo {MIN_LENGTH} caracteres. Usa mayúsculas, números y símbolos.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm" className="text-xs font-medium">
              Confirmar contraseña <span className="text-destructive">*</span>
            </Label>
            <Input
              id="confirm"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={MIN_LENGTH}
              placeholder="Repite la contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={
                error || (confirm.length > 0 && confirm !== password) ? true : undefined
              }
              disabled={loading}
            />
            {confirm.length > 0 && confirm !== password ? (
              <p className="text-[11px] text-destructive">Las contraseñas no coinciden.</p>
            ) : null}
          </div>
          {error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={loading || hasSession === null || !password || !confirm}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Guardando…
              </>
            ) : (
              "Actualizar contraseña"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
