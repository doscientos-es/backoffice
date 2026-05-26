"use client";

import { Button } from "@/components/ui/button";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateProfile } from "./actions";

interface Props {
  name: string;
  email: string;
  emailAlias: string | null;
  emailSendEnabled: boolean;
  signatureHtml: string | null;
}

export function ProfileForm({ name, email, emailAlias, emailSendEnabled, signatureHtml }: Props) {
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
          <Label className="text-xs font-medium">Nombre</Label>
          <Input value={name} disabled />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium">Email</Label>
          <Input value={email} disabled />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email_alias" className="text-xs font-medium">Alias de envío</Label>
          <Input
            id="email_alias"
            name="email_alias"
            type="email"
            defaultValue={emailAlias ?? ""}
            placeholder="notificaciones@empresa.com"
          />
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
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signature_html" className="text-xs font-medium">Firma HTML</Label>
        <Textarea
          id="signature_html"
          name="signature_html"
          rows={5}
          defaultValue={signatureHtml ?? ""}
          placeholder="<p>Un saludo,<br/><strong>Tu Nombre</strong></p>"
        />
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        <FormFeedback state={feedback.state} successLabel="Perfil guardado" />
        <Button type="submit" size="sm" disabled={feedback.pending}>
          {feedback.pending ? "Guardando…" : "Guardar perfil"}
        </Button>
      </div>
    </form>
  );
}
