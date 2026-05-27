"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormDirty } from "@/lib/hooks/use-form-dirty";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { updateProject } from "../actions";
import type { GitHubSyncMode } from "../github-sync-section";
import { ProjectFormFields } from "../project-form-fields";

type Project = {
  id: string;
  client_id: string;
  name: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  description: string | null;
  github_sync_mode: GitHubSyncMode | null;
  github_repo: string | null;
  github_installation_id: number | null;
  github_auto_sync: boolean | null;
};

interface Props {
  project: Project;
  clients: Array<{ id: string; name: string }>;
}

export function ProjectEditDialog({ project, clients }: Props) {
  const [open, setOpen] = useState(false);
  const feedback = useFormFeedback();
  const { formRef, isDirty, reset } = useFormDirty<HTMLFormElement>();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    feedback.setPending();
    const fd = new FormData(e.currentTarget);
    const res = await updateProject({
      id: project.id,
      client_id: fd.get("client_id")?.toString() ?? "",
      name: fd.get("name")?.toString() ?? "",
      description: fd.get("description")?.toString() ?? "",
      status: fd.get("status")?.toString() ?? "planning",
      starts_at: fd.get("starts_at")?.toString() ?? "",
      ends_at: fd.get("ends_at")?.toString() ?? "",
      github_sync_mode: fd.get("github_sync_mode")?.toString() ?? "none",
      github_auto_sync: !!fd.get("github_auto_sync"),
      github_repo: fd.get("github_repo")?.toString() ?? "",
      github_installation_id: fd.get("github_installation_id")?.toString() ?? "",
    });
    if (!res.ok) return feedback.setError(res.error);
    feedback.setSuccess("Guardado");
    reset();
    setTimeout(() => setOpen(false), 400);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) feedback.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" aria-hidden />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar proyecto</DialogTitle>
          <DialogDescription>Actualiza los datos del proyecto.</DialogDescription>
        </DialogHeader>
        <form
          ref={formRef}
          onSubmit={onSubmit}
          className="flex flex-col gap-5 max-h-[70vh] overflow-y-auto pr-1"
        >
          <ProjectFormFields
            idPrefix={`edit-${project.id}`}
            clients={clients}
            showClientPlaceholder={false}
            defaults={{
              client_id: project.client_id,
              name: project.name,
              status: project.status,
              starts_at: project.starts_at,
              ends_at: project.ends_at,
              description: project.description,
              github_sync_mode: project.github_sync_mode ?? "none",
              github_repo: project.github_repo,
              github_installation_id: project.github_installation_id,
              github_auto_sync: project.github_auto_sync ?? true,
            }}
          />
          <div className="flex items-center justify-end gap-3 border-t border-border pt-3">
            <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
            <SubmitButton
              loading={feedback.pending}
              disabled={!isDirty}
              pendingLabel="Guardando…"
            >
              Guardar cambios
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
