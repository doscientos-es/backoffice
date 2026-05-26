"use client";

import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
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
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Nombre</Label>
          <Input value={name} disabled aria-readonly />
          <p className="text-[11px] text-muted-foreground">Sincronizado con tu cuenta.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Email</Label>
          <Input value={email} disabled aria-readonly />
          <p className="text-[11px] text-muted-foreground">No editable desde aquí.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email_alias" className="text-xs font-medium">
            Alias de envío
          </Label>
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
          <p id="email-alias-hint" className="text-[11px] text-muted-foreground">
            Dirección desde la que se envían los emails a tus clientes.
          </p>
        </div>
        <div className="flex flex-col gap-1.5 justify-center pt-4">
          <Label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="email_send_enabled"
              value="on"
              defaultChecked={emailSendEnabled}
              className="h-4 w-4 rounded border-border"
            />
            Activar envío de emails
          </Label>
          <p className="text-[11px] text-muted-foreground">
            Si está desactivado, los envíos quedan registrados pero no se entregan.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="github_handle" className="text-xs font-medium">
          GitHub handle
        </Label>
        <Input
          id="github_handle"
          name="github_handle"
          defaultValue={githubHandle ?? ""}
          placeholder="tu-usuario"
          maxLength={39}
          autoComplete="off"
          aria-describedby="github-hint"
        />
        <p id="github-hint" className="text-[11px] text-muted-foreground">
          Se usa para sincronizar tareas con issues y PRs de GitHub.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signature_html" className="text-xs font-medium">
          Firma HTML
        </Label>
        <Textarea
          id="signature_html"
          name="signature_html"
          rows={5}
          defaultValue={signatureHtml ?? ""}
          placeholder="<p>Un saludo,<br/><strong>Tu Nombre</strong></p>"
          aria-describedby="signature-hint"
          className="font-mono text-xs"
        />
        <p id="signature-hint" className="text-[11px] text-muted-foreground">
          Se añade al final de los emails enviados desde la app.
        </p>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        <FormFeedback state={feedback.state} successLabel="Perfil guardado" />
        <SubmitButton pendingLabel="Guardando…" loading={feedback.pending}>
          Guardar perfil
        </SubmitButton>
      </div>
    </form>
  );
}
