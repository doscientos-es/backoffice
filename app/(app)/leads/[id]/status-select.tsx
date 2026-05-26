"use client";

import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Select } from "@/components/ui/select";
import { updateLeadStatus } from "../actions";

const OPTIONS = [
  { value: "new", label: "Nuevo" },
  { value: "qualifying", label: "En cualificación" },
  { value: "quoted", label: "Presupuestado" },
  { value: "won", label: "Ganado" },
  { value: "lost", label: "Perdido" },
  { value: "archived", label: "Archivado" },
] as const;

export function LeadStatusSelect({ leadId, status }: { leadId: string; status: string }) {
  const feedback = useFormFeedback();
  return (
    <div className="flex items-center gap-2">
      <Select
        defaultValue={status}
        disabled={feedback.pending}
        className="h-8 w-40"
        onChange={async (e) => {
          const next = e.target.value;
          feedback.setPending();
          const res = await updateLeadStatus({ leadId, status: next });
          if (!res.ok) feedback.setError(res.error);
          else feedback.setSuccess("Estado actualizado");
        }}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <FormFeedback state={feedback.state} pendingLabel="Actualizando…" />
    </div>
  );
}
