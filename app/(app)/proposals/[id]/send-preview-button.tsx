"use client";

import { Button } from "@/components/ui/button";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCheck, Send } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { markProposalAsSent, sendPreviewLink } from "../actions";

type Props = {
  id: string;
  defaultEmail: string | null;
  alreadySent: boolean;
};

/**
 * Send the public preview URL of a proposal to the client by email. Expands
 * inline so the team can override the recipient address and add a short
 * message before sending.
 */
export function SendPreviewButton({ id, defaultEmail, alreadySent }: Props) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(defaultEmail ?? "");
  const [message, setMessage] = useState("");
  const feedback = useFormFeedback({ successResetMs: 4000 });
  const markFeedback = useFormFeedback({ successResetMs: 4000 });
  const [pending, startTransition] = useTransition();
  const [markPending, startMarkTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const handleMarkAsSent = () => {
    markFeedback.setPending();
    startMarkTransition(async () => {
      const res = await markProposalAsSent({ id });
      if (!res.ok) {
        markFeedback.setError(res.error);
      } else {
        markFeedback.setSuccess("Marcada como enviada");
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    feedback.setPending();
    startTransition(async () => {
      const res = await sendPreviewLink({
        id,
        to: to.trim() || undefined,
        message: message.trim() || undefined,
      });
      if (!res.ok) {
        feedback.setError(res.error);
        return;
      }
      feedback.setSuccess(res.mocked ? "Email simulado (modo dev)" : "Email enviado");
      setOpen(false);
    });
  };

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <FormFeedback state={markFeedback.state} pendingLabel="Guardando…" />
        <FormFeedback state={feedback.state} pendingLabel="Enviando…" />
        {!alreadySent && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleMarkAsSent}
            disabled={markPending || pending}
          >
            <CheckCheck aria-hidden /> Marcar como enviada
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={() => setOpen(true)}
          disabled={pending || markPending}
        >
          <Send aria-hidden /> {alreadySent ? "Reenviar preview" : "Enviar preview al cliente"}
        </Button>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="preview-to" className="text-xs font-medium">
          Email del cliente
        </label>
        <Input
          id="preview-to"
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="cliente@ejemplo.com"
          required
          disabled={pending}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="preview-message" className="text-xs font-medium">
          Mensaje (opcional)
        </label>
        <Textarea
          id="preview-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Te dejo el enlace para que revises la propuesta…"
          disabled={pending}
        />
      </div>
      <div className="flex items-center justify-end gap-3">
        <FormFeedback state={feedback.state} pendingLabel="Enviando…" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Enviando…" : "Enviar"}
        </Button>
      </div>
    </form>
  );
}
