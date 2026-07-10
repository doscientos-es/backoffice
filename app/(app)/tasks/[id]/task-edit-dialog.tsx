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
import type { TaskPriorityType, TaskStatusType } from "@/lib/schemas/task";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { updateTask } from "../actions";
import { TaskFormFields } from "../task-form-fields";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_id: string | null;
  due_date: string | null;
};

interface Props {
  task: Task;
  members: Array<{ id: string; name: string }>;
}

export function TaskEditDialog({ task, members }: Props) {
  const [open, setOpen] = useState(false);
  const feedback = useFormFeedback();
  const { formRef, isDirty, reset } = useFormDirty<HTMLFormElement>();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    feedback.setPending();
    const fd = new FormData(e.currentTarget);
    const res = await updateTask({
      id: task.id,
      title: fd.get("title")?.toString() ?? "",
      description: fd.get("description")?.toString() ?? "",
      assignee_id: fd.get("assignee_id")?.toString() ?? "",
      status: (fd.get("status")?.toString() ?? "todo") as TaskStatusType,
      priority: (fd.get("priority")?.toString() ?? "medium") as TaskPriorityType,
      due_date: fd.get("due_date")?.toString() ?? "",
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
          <DialogTitle>Editar tarea</DialogTitle>
          <DialogDescription>Actualiza los datos de la tarea.</DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={onSubmit} className="flex flex-col max-h-[70vh]">
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-5 scroll-fade no-scrollbar">
            <TaskFormFields
              idPrefix={`edit-${task.id}`}
              members={members}
              defaults={{
                title: task.title,
                description: task.description,
                assignee_id: task.assignee_id,
                status: task.status,
                priority: task.priority,
                due_date: task.due_date,
              }}
            />
          </div>
          <div className="shrink-0 flex items-center justify-end gap-3 border-t border-border pt-3">
            <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
            <SubmitButton loading={feedback.pending} disabled={!isDirty} pendingLabel="Guardando…">
              Guardar cambios
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
