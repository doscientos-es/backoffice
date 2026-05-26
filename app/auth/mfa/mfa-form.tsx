"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBrowserClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function MfaForm() {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const feedback = useFormFeedback();

  useEffect(() => {
    (async () => {
      const supabase = getBrowserClient();
      const { data } = await supabase.auth.mfa.listFactors();
      const totp = data?.totp?.find((f) => f.status === "verified");
      if (totp) setFactorId(totp.id);
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) {
      feedback.setError("Configura primero un factor TOTP en Supabase.");
      return;
    }
    feedback.setPending();
    const supabase = getBrowserClient();
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
    if (cErr || !challenge) {
      feedback.setError(cErr?.message ?? "Error iniciando reto MFA");
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (vErr) {
      feedback.setError(vErr.message);
      return;
    }
    router.replace("/inicio");
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="code">Código TOTP</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <FormFeedback state={feedback.state} pendingLabel="Verificando…" />
            <Button type="submit" disabled={feedback.pending || code.length !== 6}>
              {feedback.pending ? "Verificando…" : "Verificar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
