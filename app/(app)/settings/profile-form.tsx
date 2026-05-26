"use client";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { updateProfile } from "./actions";

interface Props {
  name: string;
  email: string;
  emailAlias: string | null;
  emailSendEnabled: boolean;
  signatureHtml: string | null;
  githubHandle: string | null;
}

export function ProfileForm({
  name,
  email,
  emailAlias,
  emailSendEnabled,
  signatureHtml,
  githubHandle,
}: Props) {
  const feedback = useFormFeedback();

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    feedback.setPending();
    const result = await updateProfile(fd);
    if (result.ok) feedback.setSuccess("Perfil guardado");
    else feedback.setError(result.error);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel className="text-xs font-medium text-muted-foreground">Nombre</FieldLabel>
          <Input value={name} disabled aria-readonly />
          <FieldDescription>Sincronizado con tu cuenta.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel className="text-xs font-medium text-muted-foreground">Email</FieldLabel>
          <Input value={email} disabled aria-readonly />
          <FieldDescription>No editable desde aquí.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="email_alias" className="text-xs font-medium">
            Alias de envío
          </FieldLabel>
          <Input
            id="email_alias"
            name="email_alias"
            type="email"
            inputMode="email"
            autoComplete="email"
            defaultValue={emailAlias ?? ""}
            placeholder="notificaciones@empresa.com"
            aria-describedby="email-alias-hint"
          />
          <FieldDescription id="email-alias-hint">
            Dirección desde la que se envían los emails a tus clientes.
          </FieldDescription>
        </Field>
        <Field orientation="horizontal" className="items-start pt-4">
          <input
            type="checkbox"
            id="email_send_enabled"
            name="email_send_enabled"
            value="on"
            defaultChecked={emailSendEnabled}
            className="mt-0.5 size-4 rounded border-border"
          />
          <FieldContent>
            <FieldLabel htmlFor="email_send_enabled" className="text-sm font-normal">
              Activar envío de emails
            </FieldLabel>
            <FieldDescription>
              Si está desactivado, los envíos quedan registrados pero no se entregan.
            </FieldDescription>
          </FieldContent>
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="github_handle" className="text-xs font-medium">
          GitHub handle
        </FieldLabel>
        <Input
          id="github_handle"
          name="github_handle"
          defaultValue={githubHandle ?? ""}
          placeholder="tu-usuario"
          maxLength={39}
          autoComplete="off"
          aria-describedby="github-hint"
        />
        <FieldDescription id="github-hint">
          Se usa para sincronizar tareas con issues y PRs de GitHub.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="signature_html" className="text-xs font-medium">
          Firma HTML
        </FieldLabel>
        <Textarea
          id="signature_html"
          name="signature_html"
          rows={5}
          defaultValue={signatureHtml ?? ""}
          placeholder="<p>Un saludo,<br/><strong>Tu Nombre</strong></p>"
          aria-describedby="signature-hint"
          className="font-mono text-xs"
        />
        <FieldDescription id="signature-hint">
          Se añade al final de los emails enviados desde la app.
        </FieldDescription>
      </Field>
      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        <FormFeedback state={feedback.state} successLabel="Perfil guardado" />
        <SubmitButton pendingLabel="Guardando…" loading={feedback.pending}>
          Guardar perfil
        </SubmitButton>
      </div>
    </form>
  );
}
