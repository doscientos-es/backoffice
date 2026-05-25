"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { acceptProposal, rejectProposal } from "./actions";

export function ProposalActions({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

  const onAccept = () => {
    startTransition(async () => {
      const res = await acceptProposal(token);
      if (res.ok) toast.success("Propuesta aceptada. Gracias.");
      else toast.error(res.error);
    });
  };

  const onReject = () => {
    startTransition(async () => {
      const res = await rejectProposal(token, reason.trim() || undefined);
      if (res.ok) toast.success("Respuesta registrada.");
      else toast.error(res.error);
    });
  };

  if (showReject) {
    return (
      <Card>
        <CardHeader><CardTitle>Rechazar propuesta</CardTitle></CardHeader>
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
              disabled={pending}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowReject(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={onReject} disabled={pending}>
              {pending ? "Enviando…" : "Confirmar rechazo"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>Tu respuesta</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[color:var(--text-muted)]">
          Acepta o rechaza esta propuesta. Esta acción es definitiva.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowReject(true)} disabled={pending}>
            Rechazar
          </Button>
          <Button onClick={onAccept} disabled={pending}>
            {pending ? "Procesando…" : "Aceptar propuesta"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
