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
import type { TaskPriorityType, TaskStatusType } from "@/lib/schemas/task";
import { Plus } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { createTask } from "./actions";
import { TaskFormFields } from "./task-form-fields";

interface Props {
  /** Pre-fills `project_id`. Renders as a hidden input so parent stays fixed. */
  projectId?: string;
  /** Pre-fills `lead_id`. Renders as a hidden input so parent stays fixed. */
  leadId?: string;
  projects?: Array<{ id: string; name: string }>;
  leads?: Array<{ id: string; name: string }>;
  members?: Array<{ id: string; name: string }>;
  /** Custom trigger. Falls back to a primary button labelled "Nueva tarea". */
  trigger?: ReactNode;
  /** Optional callback fired after a successful creation (e.g. router refresh). */
  onCreated?: (id: string) => void;
}

/**
 * In-context task creation dialog. Mirrors `TaskEditDialog` but invokes
 * `createTask` and reuses the same `TaskFormFields` block. The form is reset
 * after each successful submission so the dialog can be reused without
 * remounting.
 */
export function TaskCreateDialog({
  projectId,
  leadId,
  projects = [],
  leads = [],
  members = [],
  trigger,
  onCreated,
}: Props) {
  const [open, setOpen] = useState(false);
  const feedback = useFormFeedback();
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    feedback.setPending();
    const fd = new FormData(e.currentTarget);
    const res = await createTask({
      title: fd.get("title")?.toString() ?? "",
      description: fd.get("description")?.toString() ?? "",
      project_id: projectId ?? fd.get("project_id")?.toString() ?? "",
      lead_id: leadId ?? fd.get("lead_id")?.toString() ?? "",
      assignee_id: fd.get("assignee_id")?.toString() ?? "",
      status: (fd.get("status")?.toString() ?? "todo") as TaskStatusType,
      priority: (fd.get("priority")?.toString() ?? "medium") as TaskPriorityType,
      due_date: fd.get("due_date")?.toString() ?? "",
    });
    if (!res.ok) return feedback.setError(res.error);
    feedback.setSuccess("Tarea creada");
    formRef.current?.reset();
    onCreated?.(res.id);
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
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" aria-hidden />
            Nueva tarea
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crear tarea</DialogTitle>
          <DialogDescription>
            Las tareas se asocian al proyecto actual y aparecen en el Kanban.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={onSubmit} className="flex flex-col max-h-[70vh]">
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-5">
            {projectId ? <input type="hidden" name="project_id" value={projectId} /> : null}
            {leadId ? <input type="hidden" name="lead_id" value={leadId} /> : null}
            <TaskFormFields
              idPrefix="create"
              autoFocusTitle
              includeParentSelectors={!projectId && !leadId}
              projects={projects}
              leads={leads}
              members={members}
              defaults={{ status: "todo", priority: "medium" }}
            />
          </div>
          <div className="shrink-0 flex items-center justify-end gap-3 border-t border-border pt-3">
            <FormFeedback state={feedback.state} pendingLabel="Creando…" />
            <SubmitButton loading={feedback.pending} pendingLabel="Creando…">
              Crear tarea
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
