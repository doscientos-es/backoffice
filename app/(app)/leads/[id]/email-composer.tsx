"use client";

import { Button } from "@/components/ui/button";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { sendEmailToLead } from "../actions";

export type EmailComposerProps = {
  leadId: string;
  defaultTo: string;
  disabled?: boolean;
  disabledReason?: string;
};

export function EmailComposer({ leadId, defaultTo, disabled, disabledReason }: EmailComposerProps) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const feedback = useFormFeedback();

  if (disabled) {
    return (
      <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        {disabledReason ?? "Envío de email no disponible."}
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!to || !subject || !body) {
      feedback.setError("Completa destinatario, asunto y cuerpo.");
      return;
    }
    feedback.setPending();
    const res = await sendEmailToLead({
      leadId,
      to,
      subject,
      bodyHtml: body,
      includeSignature: true,
    });
    if (res.ok) {
      feedback.setSuccess(res.mocked ? "Email simulado (modo dev)" : "Email enviado");
      setSubject("");
      setBody("");
    } else {
      feedback.setError(res.error);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="to" className="text-xs font-medium">
          Para
        </Label>
        <Input
          id="to"
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="subject" className="text-xs font-medium">
          Asunto
        </Label>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Hola {{nombre}}, …"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="body" className="text-xs font-medium">
          Mensaje (HTML)
        </Label>
        <Textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          placeholder="<p>Hola {{nombre}},</p><p>…</p>"
          required
        />
        <p className="text-xs text-muted-foreground">
          Variables: <code>{"{{nombre}}"}</code>, <code>{"{{empresa}}"}</code>,{" "}
          <code>{"{{email}}"}</code>. Tu firma se añade al final.
        </p>
      </div>
      <div className="flex items-center justify-end gap-3">
        <FormFeedback state={feedback.state} pendingLabel="Enviando…" successLabel="Email enviado" />
        <Button type="submit" size="sm" disabled={feedback.pending}>
          {feedback.pending ? "Enviando…" : "Enviar email"}
        </Button>
      </div>
    </form>
  );
}
