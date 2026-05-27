import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const TASK_STATUS_OPTIONS = [
  { value: "todo", label: "Por hacer" },
  { value: "in_progress", label: "En curso" },
  { value: "in_review", label: "Revisión" },
  { value: "done", label: "Terminada" },
  { value: "cancelled", label: "Cancelada" },
] as const;

export const TASK_PRIORITY_OPTIONS = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
] as const;

export type TaskFormDefaults = {
  title?: string;
  description?: string | null;
  project_id?: string | null;
  lead_id?: string | null;
  milestone_id?: string | null;
  assignee_id?: string | null;
  status?: string | null;
  priority?: string | null;
  due_date?: string | null;
};

interface Props {
  defaults?: TaskFormDefaults;
  /** Avoids `id` collisions when create and edit forms coexist on the page. */
  idPrefix?: string;
  autoFocusTitle?: boolean;
  /** Show project + lead selectors (create-only). Edit flow keeps the parent fixed. */
  includeParentSelectors?: boolean;
  projects?: Array<{ id: string; name: string }>;
  leads?: Array<{ id: string; name: string }>;
  milestones?: Array<{ id: string; name: string }>;
  members?: Array<{ id: string; name: string }>;
}

/**
 * Shared field block for the task create and edit forms. Parent selectors
 * (project / lead) only render on create — edit keeps the parent fixed.
 */
export function TaskFormFields({
  defaults,
  idPrefix = "task",
  autoFocusTitle = false,
  includeParentSelectors = false,
  projects = [],
  leads = [],
  milestones = [],
  members = [],
}: Props) {
  const d = defaults ?? {};
  return (
    <>
      <FormRow label="Título" htmlFor={`${idPrefix}-title`} required>
        <Input
          id={`${idPrefix}-title`}
          name="title"
          required
          maxLength={200}
          autoFocus={autoFocusTitle}
          defaultValue={d.title ?? ""}
        />
      </FormRow>
      <FormRow label="Descripción" htmlFor={`${idPrefix}-description`}>
        <Textarea
          id={`${idPrefix}-description`}
          name="description"
          rows={3}
          maxLength={8000}
          defaultValue={d.description ?? ""}
        />
      </FormRow>
      <div className="grid gap-5 sm:grid-cols-2">
        {includeParentSelectors ? (
          <>
            <FormRow label="Proyecto" htmlFor={`${idPrefix}-project_id`}>
              <Select
                id={`${idPrefix}-project_id`}
                name="project_id"
                defaultValue={d.project_id ?? ""}
              >
                <option value="">—</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </FormRow>
            <FormRow label="Lead" htmlFor={`${idPrefix}-lead_id`}>
              <Select id={`${idPrefix}-lead_id`} name="lead_id" defaultValue={d.lead_id ?? ""}>
                <option value="">—</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </FormRow>
          </>
        ) : null}
        <FormRow label="Hito" htmlFor={`${idPrefix}-milestone_id`}>
          <Select
            id={`${idPrefix}-milestone_id`}
            name="milestone_id"
            defaultValue={d.milestone_id ?? ""}
          >
            <option value="">—</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Asignada a" htmlFor={`${idPrefix}-assignee_id`}>
          <Select
            id={`${idPrefix}-assignee_id`}
            name="assignee_id"
            defaultValue={d.assignee_id ?? ""}
          >
            <option value="">—</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Estado" htmlFor={`${idPrefix}-status`}>
          <Select id={`${idPrefix}-status`} name="status" defaultValue={d.status ?? "todo"}>
            {TASK_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Prioridad" htmlFor={`${idPrefix}-priority`}>
          <Select
            id={`${idPrefix}-priority`}
            name="priority"
            defaultValue={d.priority ?? "medium"}
          >
            {TASK_PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Vencimiento" htmlFor={`${idPrefix}-due_date`}>
          <Input
            id={`${idPrefix}-due_date`}
            name="due_date"
            type="date"
            defaultValue={d.due_date ?? ""}
          />
        </FormRow>
      </div>
    </>
  );
}
