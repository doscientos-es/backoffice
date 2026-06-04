"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { useMemo, useState, useTransition } from "react";
import { completeOnboarding, skipOnboarding } from "./actions";

interface Props {
  defaultName: string;
  email: string;
  defaultGithubHandle: string | null;
  defaultEmailAlias: string | null;
  defaultEmailSendEnabled: boolean;
  defaultSignatureHtml: string | null;
}

const HANDLE_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/;

export function OnboardingForm({
  defaultName,
  email,
  defaultGithubHandle,
  defaultEmailAlias,
  defaultEmailSendEnabled,
  defaultSignatureHtml,
}: Props) {
  const feedback = useFormFeedback();
  const [skipPending, startSkip] = useTransition();
  const [name, setName] = useState(defaultName);
  const [handle, setHandle] = useState(defaultGithubHandle ?? "");

  const avatarSrc = useMemo(() => {
    const trimmed = handle.trim();
    return HANDLE_RE.test(trimmed) ? `https://github.com/${trimmed}.png?size=200` : undefined;
  }, [handle]);

  const initials = useMemo(() => {
    const source = name.trim() || email;
    return source
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [name, email]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    feedback.setPending();
    const result = await completeOnboarding(fd);
    if (!result.ok) {
      feedback.setError(result.error);
      return;
    }
    feedback.setSuccess("Listo");
    // Hard navigation (not router.replace + refresh): the server action already
    // ran revalidatePath, so a real request re-renders /inicio with the now
    // onboarded state and avoids a client Router Cache race bouncing the user
    // back to /onboarding on the first attempt.
    window.location.assign("/inicio");
  }

  function handleSkip() {
    startSkip(async () => {
      await skipOnboarding();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex items-center gap-4 py-4">
          <Avatar size="lg" className="size-14">
            {avatarSrc ? <AvatarImage src={avatarSrc} alt={name || email} /> : null}
            <AvatarFallback>{initials || "·"}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{name || "Sin nombre"}</span>
            <span className="text-xs text-muted-foreground">{email}</span>
            <span className="text-[11px] text-muted-foreground">
              {avatarSrc
                ? "Avatar de GitHub detectado."
                : "Añade tu handle de GitHub para usar tu avatar."}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="name" className="text-xs font-medium">
            Nombre completo
          </FieldLabel>
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            maxLength={160}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="github_handle" className="text-xs font-medium">
            GitHub handle <span className="text-muted-foreground">(opcional)</span>
          </FieldLabel>
          <Input
            id="github_handle"
            name="github_handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="tu-usuario"
            maxLength={39}
            autoComplete="off"
          />
          <FieldDescription>
            Sincroniza tus tareas con issues y PRs, y nos da tu avatar.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="email_alias" className="text-xs font-medium">
            Alias de envío <span className="text-muted-foreground">(opcional)</span>
          </FieldLabel>
          <Input
            id="email_alias"
            name="email_alias"
            type="email"
            inputMode="email"
            defaultValue={defaultEmailAlias ?? ""}
            placeholder="notificaciones@empresa.com"
            autoComplete="email"
          />
          <FieldDescription>
            Dirección desde la que se enviarán los emails que mandes a clientes.
          </FieldDescription>
        </Field>
        <Field orientation="horizontal" className="items-center pt-5">
          <input
            type="checkbox"
            id="email_send_enabled"
            name="email_send_enabled"
            value="on"
            defaultChecked={defaultEmailSendEnabled}
            className="size-4 rounded border-border"
          />
          <FieldLabel htmlFor="email_send_enabled" className="text-sm font-normal">
            Activar envío de emails
          </FieldLabel>
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="signature_html" className="text-xs font-medium">
          Firma para tus emails <span className="text-muted-foreground">(opcional)</span>
        </FieldLabel>
        <Textarea
          id="signature_html"
          name="signature_html"
          rows={4}
          defaultValue={defaultSignatureHtml ?? ""}
          placeholder="<p>Un saludo,<br/><strong>Tu Nombre</strong></p>"
          className="font-mono text-xs"
        />
      </Field>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
        <Button
          type="button"
          variant="ghost"
          onClick={handleSkip}
          disabled={skipPending || feedback.pending}
        >
          {skipPending ? "Saltando…" : "Saltar por ahora"}
        </Button>
        <div className="flex items-center gap-3">
          <FormFeedback state={feedback.state} successLabel="Listo" />
          <SubmitButton pendingLabel="Guardando…" loading={feedback.pending}>
            Empezar a usar doscientos
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
