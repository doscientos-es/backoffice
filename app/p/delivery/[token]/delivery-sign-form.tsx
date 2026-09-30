"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { signDeliveryNote } from "./actions";

export function DeliverySignForm({ token, consent }: { token: string; consent: string }) {
  const router = useRouter();
  const feedback = useFormFeedback({ successResetMs: 0 });
  const [signerName, setSignerName] = useState("");
  const [signerRole, setSignerRole] = useState("");
  const [accepted, setAccepted] = useState(false);

  const onSign = async () => {
    if (!signerName.trim()) {
      feedback.setError("Indica tu nombre completo");
      return;
    }
    if (!accepted) {
      feedback.setError("Debes confirmar la conformidad para firmar el albarán");
      return;
    }
    feedback.setPending();
    const res = await signDeliveryNote(token, {
      signer_name: signerName.trim(),
      signer_role: signerRole.trim() || undefined,
      accepts_terms: true,
    });
    if (!res.ok) {
      feedback.setError(res.error);
      return;
    }
    feedback.setSuccess("Albarán firmado");
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Firmar conformidad</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="signer-name">Nombre completo</Label>
            <Input
              id="signer-name"
              autoComplete="name"
              value={signerName}
              onChange={(event) => setSignerName(event.target.value)}
              disabled={feedback.pending}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="signer-role">Cargo (opcional)</Label>
            <Input
              id="signer-role"
              autoComplete="organization-title"
              value={signerRole}
              onChange={(event) => setSignerRole(event.target.value)}
              disabled={feedback.pending}
            />
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            disabled={feedback.pending}
            className="mt-0.5 size-4 shrink-0"
          />
          <span>{consent}</span>
        </label>
        <FormFeedback state={feedback.state} pendingLabel="Firmando…" />
        <Button className="w-full" onClick={onSign} disabled={feedback.pending}>
          {feedback.pending ? "Firmando…" : "Firmar albarán"}
        </Button>
      </CardContent>
    </Card>
  );
}
