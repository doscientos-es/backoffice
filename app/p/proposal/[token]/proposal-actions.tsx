"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { acceptProposal, rejectProposal } from "./actions";

export function ProposalActions({ token }: { token: string }) {
  const feedback = useFormFeedback({ successResetMs: 0 });
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

  const onAccept = async () => {
    feedback.setPending();
    const res = await acceptProposal(token);
    if (res.ok) feedback.setSuccess("Propuesta aceptada. Gracias.");
    else feedback.setError(res.error);
  };

  const onReject = async () => {
    feedback.setPending();
    const res = await rejectProposal(token, reason.trim() || undefined);
    if (res.ok) feedback.setSuccess("Respuesta registrada.");
    else feedback.setError(res.error);
  };

  if (showReject) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rechazar propuesta</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">Motivo (opcional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Cuéntanos qué podemos mejorar"
              rows={4}
              maxLength={500}
              disabled={feedback.pending}
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <FormFeedback state={feedback.state} pendingLabel="Enviando…" />
            <Button
              variant="ghost"
              onClick={() => setShowReject(false)}
              disabled={feedback.pending}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={onReject} disabled={feedback.pending}>
              {feedback.pending ? "Enviando…" : "Confirmar rechazo"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tu respuesta</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[color:var(--text-muted)]">
          Acepta o rechaza esta propuesta. Esta acción es definitiva.
        </p>
        <div className="flex items-center gap-3">
          <FormFeedback state={feedback.state} pendingLabel="Procesando…" />
          <Button variant="outline" onClick={() => setShowReject(true)} disabled={feedback.pending}>
            Rechazar
          </Button>
          <Button onClick={onAccept} disabled={feedback.pending}>
            {feedback.pending ? "Procesando…" : "Aceptar propuesta"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
