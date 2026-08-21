"use client";

import { useState } from "react";
import { usePasskeyVerification } from "@/components/security/use-passkey-verification";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { userVerificationScope } from "@/lib/security/user-verification-scope";
import { updateGmailSyncMailboxes } from "../actions";

export function GmailSyncForm({ mailboxes }: { mailboxes: string[] }) {
  const feedback = useFormFeedback();
  const [value, setValue] = useState(() => mailboxes.join("\n"));
  const { challenge, verifyWithPasskey } = usePasskeyVerification();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    feedback.setPending();
    const verification = await verifyWithPasskey(
      userVerificationScope("integrations.gmail_sync_mailboxes.update", "settings:1"),
    );
    if (!verification.ok) return feedback.setError(verification.error);

    const result = await updateGmailSyncMailboxes({
      mailboxes: value
        .split(/[\n,;]+/)
        .map((email) => email.trim())
        .filter(Boolean),
    });
    if (!result.ok) return feedback.setError(result.error);
    feedback.setSuccess("Buzones Gmail guardados");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="gmail-sync-mailboxes">Buzones generales</FieldLabel>
        <Textarea
          id="gmail-sync-mailboxes"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="hola@doscientos.es"
          rows={5}
          maxLength={3000}
          aria-describedby="gmail-sync-mailboxes-hint"
        />
        <FieldDescription id="gmail-sync-mailboxes-hint">
          Un email por línea, separado por comas o punto y coma. Los miembros activos del equipo se
          sincronizan automáticamente; añade aquí solo buzones compartidos o generales.
        </FieldDescription>
      </Field>
      <div className="flex items-center justify-end gap-3">
        <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
        <SubmitButton loading={feedback.pending}>Guardar buzones</SubmitButton>
      </div>
      {challenge}
    </form>
  );
}
