"use client";

import { AiNotice } from "@/components/ui/ai-notice";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { sendEmailToLead } from "../actions";

export type EmailComposerProps = {
  leadId: string;
  defaultTo: string;
  /** Pre-fills the subject line (e.g. a reason-based recovery template). */
  defaultSubject?: string;
  /** Pre-fills the Markdown body. */
  defaultBody?: string;
  /** Kind and extra instructions sent to the optional AI drafting endpoint. */
  draftKind?: string;
  draftInstructions?: string;
  disabled?: boolean;
  disabledReason?: string;
  aiEnabled?: boolean;
  onSuccess?: () => void;
};

export function EmailComposer({
  leadId,
  defaultTo,
  defaultSubject,
  defaultBody,
  draftKind = "follow_up",
  draftInstructions,
  disabled,
  disabledReason,
  aiEnabled,
  onSuccess,
}: EmailComposerProps) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject ?? "");
  const [body, setBody] = useState(defaultBody ?? "");
  const [drafting, setDrafting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const feedback = useFormFeedback();

  async function handleDraftWithAI() {
    setDrafting(true);
    try {
      const res = await fetch("/api/crm/ai/draft-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          kind: draftKind,
          instructions: draftInstructions,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al generar el borrador.");
      setSubject(json.subject ?? "");
      setBody(json.body ?? "");
    } catch (err) {
      feedback.setError(err instanceof Error ? err.message : "Error al generar el borrador.");
    } finally {
      setDrafting(false);
    }
  }

  if (disabled) {
    return (
      <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        {disabledReason ?? "Envío de email no disponible."}
      </div>
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!to || !subject || !body) {
      feedback.setError("Completa destinatario, asunto y cuerpo.");
      return;
    }
    setConfirmOpen(true);
  }

  async function handleConfirmSend() {
    feedback.setPending();
    const res = await sendEmailToLead({
      leadId,
      to,
      subject,
      bodyHtml: body,
      includeSignature: true,
    });
    if (res.ok) {
      setConfirmOpen(false);
      feedback.setSuccess(res.mocked ? "Email simulado (modo dev)" : "Email enviado");
      setSubject("");
      setBody("");
      onSuccess?.();
    } else {
      setConfirmOpen(false);
      feedback.setError(res.error);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {aiEnabled ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleDraftWithAI}
            disabled={drafting}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-50"
          >
            <Sparkles className="h-3 w-3" />
            {drafting ? "Generando…" : "Generar borrador con IA"}
          </button>
        </div>
      ) : (
        <div className="flex justify-end">
          <AiNotice inline />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="to" className="text-xs font-medium">
          Para <span className="text-destructive">*</span>
        </Label>
        <Input
          id="to"
          type="email"
          inputMode="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          required
          placeholder="destinatario@empresa.com"
          autoComplete="email"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="subject" className="text-xs font-medium">
          Asunto <span className="text-destructive">*</span>
        </Label>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Hola {{nombre}}, …"
          required
          maxLength={200}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="body" className="text-xs font-medium">
          Mensaje (Markdown) <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          placeholder={"Hola **{{nombre}}**,\n\n…"}
          required
          className="font-mono text-xs"
          aria-describedby="body-hint"
        />
        <p id="body-hint" className="text-[11px] text-muted-foreground">
          Se escribe en Markdown. Variables disponibles: <code>{"{{nombre}}"}</code>,{" "}
          <code>{"{{empresa}}"}</code>, <code>{"{{email}}"}</code>. Tu firma se añade al final.
        </p>
      </div>
      <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-foreground">
        Este mensaje llegará a <strong>{to || "la dirección indicada"}</strong>. Antes de enviarlo
        podrás revisar una confirmación final.
      </p>
      <div className="flex items-center justify-end gap-3">
        <FormFeedback
          state={feedback.state}
          pendingLabel="Enviando…"
          successLabel="Email enviado"
        />
        <SubmitButton pendingLabel="Preparando…" loading={feedback.pending}>
          Revisar y enviar
        </SubmitButton>
      </div>
      </form>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="¿Enviar este email al lead?"
        description={
          <>
            <p>
              Se enviará un email real a <strong>{to}</strong>.
            </p>
            <p className="mt-2">
              <strong>Asunto:</strong> {subject}
            </p>
            <p className="mt-2">El lead recibirá el contenido que acabas de revisar.</p>
          </>
        }
        confirmLabel="Sí, enviar email"
        cancelLabel="Volver a revisar"
        pending={feedback.pending}
        onConfirm={() => void handleConfirmSend()}
      />
    </>
  );
}
