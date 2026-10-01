"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@doscientos/ui";
import { Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/utils";

import { sendQuarterlyAdvisorEmail } from "../actions";
import type { HandoffQuarter } from "./quarterly-handoff-card";

export function QuarterlySendDialog({
  open,
  onOpenChange,
  quarter,
  advisorEmail,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quarter: HandoffQuarter;
  advisorEmail: string;
  onSent: (message: string) => void;
}) {
  const router = useRouter();
  const feedback = useFormFeedback();
  const [to, setTo] = useState(advisorEmail);
  const [message, setMessage] = useState("");
  const [attachDocuments, setAttachDocuments] = useState(true);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    feedback.setPending();
    const result = await sendQuarterlyAdvisorEmail({
      year: quarter.year,
      quarter: quarter.quarter,
      to: to.trim(),
      message: message.trim() || undefined,
      attachDocuments,
    });
    if (!result.ok) {
      feedback.setError(result.error);
      return;
    }
    const skipped = result.skipped.length
      ? ` (${result.skipped.length} archivo${result.skipped.length === 1 ? "" : "s"} no adjuntado${result.skipped.length === 1 ? "" : "s"})`
      : "";
    const text = result.mocked
      ? `Email simulado (sin Resend)${skipped}`
      : `${quarter.label} enviado con ${result.attachments} documento${result.attachments === 1 ? "" : "s"}${skipped}`;
    feedback.reset();
    onSent(text);
    setMessage("");
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar {quarter.label} a la gestoría</DialogTitle>
          <DialogDescription>
            Se enviará el Excel con facturas emitidas y gastos del trimestre
            {attachDocuments ? ", junto con los PDFs de facturas y justificantes de gastos." : "."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          {quarter.sentAt ? (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
              Este trimestre ya se envió el {formatDateTime(quarter.sentAt)}. Se enviará de nuevo.
            </p>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quarterly-email-to">Destinatario</Label>
            <Input
              id="quarterly-email-to"
              type="email"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              required
              disabled={feedback.pending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quarterly-email-message">Mensaje (opcional)</Label>
            <Textarea
              id="quarterly-email-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              maxLength={2000}
              disabled={feedback.pending}
            />
          </div>
          <label
            htmlFor="quarterly-email-attach"
            className="flex cursor-pointer items-start gap-2 rounded p-1.5 hover:bg-muted/50"
          >
            <Checkbox
              id="quarterly-email-attach"
              isSelected={attachDocuments}
              onChange={setAttachDocuments}
              isDisabled={feedback.pending}
            />
            <span className="text-sm">Adjuntar PDFs de facturas y justificantes de gastos</span>
          </label>
          <DialogFooter>
            <FormFeedback state={feedback.state} pendingLabel="Enviando…" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={feedback.pending}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={feedback.pending}>
              <Mail className="h-4 w-4" aria-hidden />
              {feedback.pending ? "Enviando…" : "Enviar email"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
