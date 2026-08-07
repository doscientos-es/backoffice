"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionResult } from "@/lib/actions/types";
import { userVerificationScope } from "@/lib/security/user-verification-scope";
import { verifyWithPasskey } from "@/lib/security/webauthn-client";
import type { WebProjectDetail } from "@/lib/webs/types";
import { createWebProject, updateWebProject } from "../actions";
import { WebFormFields } from "./web-form-fields";

type Props = {
  clients: Array<{ id: string; name: string }>;
  mode: "create" | "edit";
  projectId?: string;
  defaults?: Partial<WebProjectDetail>;
};

/** Handles the only UI path that can create or alter DB connection credentials. */
export function VerifiedWebProjectForm({ clients, mode, projectId, defaults }: Props) {
  const feedback = useFormFeedback();
  const [pending, startTransition] = useTransition();
  const isCreate = mode === "create";
  const resource = isCreate ? "web:create" : `web:${projectId}`;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    feedback.setPending();

    startTransition(async () => {
      const verification = await verifyWithPasskey(
        userVerificationScope("web.db_credentials.update", resource),
      );
      if (!verification.ok) {
        feedback.setError(verification.error);
        return;
      }

      const result = (
        isCreate ? await createWebProject(formData) : await updateWebProject(formData)
      ) as ActionResult<void>;
      if (!result.ok) feedback.setError(result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {projectId ? <input type="hidden" name="id" value={projectId} /> : null}
      <WebFormFields
        idPrefix={isCreate ? "new" : "edit"}
        clients={clients}
        defaults={defaults}
        autoFocusName={isCreate}
      />
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <FormFeedback state={feedback.state} pendingLabel="Verificando…" />
        <Button asChild variant="ghost" size="sm">
          <Link href={isCreate ? "/webs" : `/webs/${projectId}`}>Cancelar</Link>
        </Button>
        <SubmitButton pendingLabel="Verificando…" loading={pending || feedback.pending}>
          {isCreate ? "Crear web" : "Guardar cambios"}
        </SubmitButton>
      </div>
    </form>
  );
}
