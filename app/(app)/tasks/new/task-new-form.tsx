"use client";

import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import type { TaskPriorityType, TaskStatusType } from "@/lib/schemas/task";
import { useRouter } from "next/navigation";
import { createTask } from "../actions";
import { TaskFormFields } from "../task-form-fields";

interface Props {
  projects: Array<{ id: string; name: string }>;
  leads: Array<{ id: string; name: string }>;
  members: Array<{ id: string; name: string }>;
  defaults: { project_id?: string; lead_id?: string };
}

/**
 * Standalone task-creation form for `/tasks/new`. The server action
 * `createTask` no longer redirects (so it can be reused from dialogs); this
 * wrapper handles client-side navigation to the new task's detail page on
 * success.
 */
export function TaskNewForm({ projects, leads, members, defaults }: Props) {
  const router = useRouter();
  const feedback = useFormFeedback();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    feedback.setPending();
    const fd = new FormData(e.currentTarget);
    const res = await createTask({
      title: fd.get("title")?.toString() ?? "",
      description: fd.get("description")?.toString() ?? "",
      project_id: fd.get("project_id")?.toString() ?? "",
      lead_id: fd.get("lead_id")?.toString() ?? "",
      assignee_id: fd.get("assignee_id")?.toString() ?? "",
      status: (fd.get("status")?.toString() ?? "todo") as TaskStatusType,
      priority: (fd.get("priority")?.toString() ?? "medium") as TaskPriorityType,
      due_date: fd.get("due_date")?.toString() ?? "",
    });
    if (!res.ok) return feedback.setError(res.error);
    router.push(`/tasks/${res.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <TaskFormFields
        autoFocusTitle
        includeParentSelectors
        projects={projects}
        leads={leads}
        members={members}
        defaults={{ project_id: defaults.project_id ?? "", lead_id: defaults.lead_id ?? "" }}
      />
      <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
        <FormFeedback state={feedback.state} pendingLabel="Creando…" />
        <SubmitButton loading={feedback.pending} pendingLabel="Creando…">
          Crear tarea
        </SubmitButton>
      </div>
    </form>
  );
}
