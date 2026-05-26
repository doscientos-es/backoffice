"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useGithubHandle } from "@/lib/hooks/use-github-handle";
import { cn } from "@/lib/utils";
import { updateProfile } from "./actions";

interface Props {
  name: string;
  email: string;
  emailAlias: string | null;
  emailSendEnabled: boolean;
  githubHandle: string | null;
  jobTitle: string | null;
  phone: string | null;
  contactEmail: string | null;
}

function buildSignaturePreview(opts: {
  name: string;
  jobTitle: string;
  contactEmail: string;
  phone: string;
}): string {
  const lines: string[] = [];
  lines.push(`<strong>${opts.name}</strong>`);
  if (opts.jobTitle) lines.push(opts.jobTitle);
  lines.push("");
  lines.push("<strong>doscientos.es</strong>");
  lines.push(
    "<span style=\"color:#888\">Construimos productos digitales escalables para empresas que quieren crecer con tecnología.</span>",
  );
  lines.push("");
  if (opts.contactEmail)
    lines.push(`📩 ${opts.contactEmail}`);
  lines.push("🌐 https://doscientos.es");
  if (opts.phone) lines.push(`📱 ${opts.phone}`);
  return lines.join("<br/>");
}

export function ProfileForm({
  name,
  email,
  emailAlias,
  emailSendEnabled,
  githubHandle,
  jobTitle,
  phone,
  contactEmail,
}: Props) {
  const feedback = useFormFeedback();
  const [previewFields, setPreviewFields] = useState({
    jobTitle: jobTitle ?? "",
    contactEmail: contactEmail ?? "",
    phone: phone ?? "",
  });
  const [handle, setHandle] = useState(githubHandle ?? "");
  const handleState = useGithubHandle(handle);

  const signaturePreview = buildSignaturePreview({
    name,
    jobTitle: previewFields.jobTitle,
    contactEmail: previewFields.contactEmail,
    phone: previewFields.phone,
  });

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
          <FieldLabel htmlFor="job_title" className="text-xs font-medium">
            Rol / Cargo
          </FieldLabel>
          <Input
            id="job_title"
            name="job_title"
            defaultValue={jobTitle ?? ""}
            placeholder="Co-founder & Software Engineer"
            maxLength={160}
            autoComplete="organization-title"
            onChange={(e) =>
              setPreviewFields((p) => ({ ...p, jobTitle: e.target.value }))
            }
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="contact_email" className="text-xs font-medium">
            Email de contacto
          </FieldLabel>
          <Input
            id="contact_email"
            name="contact_email"
            type="email"
            inputMode="email"
            autoComplete="email"
            defaultValue={contactEmail ?? ""}
            placeholder="pol@doscientos.es"
            onChange={(e) =>
              setPreviewFields((p) => ({ ...p, contactEmail: e.target.value }))
            }
          />
          <FieldDescription>Aparece en la firma. Si se deja vacío, se usa el alias de envío.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="phone" className="text-xs font-medium">
            Teléfono
          </FieldLabel>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={phone ?? ""}
            placeholder="+34 600 000 000"
            maxLength={30}
            onChange={(e) =>
              setPreviewFields((p) => ({ ...p, phone: e.target.value }))
            }
          />
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
          />
          <FieldDescription>
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
        <div className="flex items-center gap-3">
          <Avatar size="default" className="shrink-0">
            {handleState.status === "valid" && handleState.avatarUrl ? (
              <AvatarImage src={handleState.avatarUrl} alt={handleState.displayName ?? handle} />
            ) : null}
            <AvatarFallback>
              {handle.trim().slice(0, 1).toUpperCase() || "·"}
            </AvatarFallback>
          </Avatar>
          <div className="relative flex-1">
            <Input
              id="github_handle"
              name="github_handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="tu-usuario"
              maxLength={39}
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="off"
              aria-invalid={
                handleState.status === "invalid" || handleState.status === "not_found"
              }
              aria-describedby="github_handle_status"
              className="pr-9"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center"
            >
              <GithubHandleIcon status={handleState.status} />
            </span>
          </div>
        </div>
        <FieldDescription id="github_handle_status">
          <GithubHandleMessage state={handleState} />
        </FieldDescription>
      </Field>

      {/* Signature preview — auto-generated */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Vista previa de la firma</p>
        <div
          className="min-h-12 rounded-lg border border-dashed border-border bg-white px-4 py-3 text-sm text-foreground"
          aria-label="Vista previa de la firma"
        >
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: contenido generado internamente */}
          <div dangerouslySetInnerHTML={{ __html: signaturePreview }} />
        </div>
        <p className="text-xs text-muted-foreground/70">
          La firma se genera automáticamente a partir de los campos anteriores.
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


function GithubHandleIcon({
  status,
}: {
  status: ReturnType<typeof useGithubHandle>["status"];
}) {
  const iconClass = "size-4";
  if (status === "checking")
    return <Loader2 className={cn(iconClass, "animate-spin text-muted-foreground")} aria-hidden />;
  if (status === "valid")
    return <CheckCircle2 className={cn(iconClass, "text-success")} aria-hidden />;
  if (status === "not_found" || status === "invalid")
    return <XCircle className={cn(iconClass, "text-destructive")} aria-hidden />;
  if (status === "rate_limited" || status === "error")
    return <AlertCircle className={cn(iconClass, "text-muted-foreground")} aria-hidden />;
  return null;
}

function GithubHandleMessage({
  state,
}: {
  state: ReturnType<typeof useGithubHandle>;
}) {
  switch (state.status) {
    case "empty":
      return <>Se usa para sincronizar tareas con issues y PRs de GitHub.</>;
    case "checking":
      return <span className="text-muted-foreground">Comprobando en GitHub…</span>;
    case "valid":
      return (
        <span className="text-success">
          {state.displayName ? `Conectado a ${state.displayName}.` : "Handle verificado."}
        </span>
      );
    case "invalid":
      return (
        <span className="text-destructive">
          Formato no válido. Solo letras, números y guiones (sin empezar/terminar en guión).
        </span>
      );
    case "not_found":
      return <span className="text-destructive">Ese usuario no existe en GitHub.</span>;
    case "rate_limited":
      return (
        <span className="text-muted-foreground">
          Demasiadas comprobaciones. Inténtalo en unos minutos.
        </span>
      );
    case "error":
      return (
        <span className="text-muted-foreground">
          No se ha podido verificar ahora mismo.
        </span>
      );
  }
}
