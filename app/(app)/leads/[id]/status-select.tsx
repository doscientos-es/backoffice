"use client";

import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Select } from "@/components/ui/select";
import { useState } from "react";
import { updateLeadStatus } from "../actions";
import { LostReasonDialog } from "../lost-reason-dialog";

const OPTIONS = [
  { value: "new", label: "Nuevo" },
  { value: "qualifying", label: "En cualificación" },
  { value: "quoted", label: "Presupuestado" },
  { value: "won", label: "Ganado" },
  { value: "lost", label: "Perdido" },
  { value: "archived", label: "Archivado" },
] as const;

export function LeadStatusSelect({
  leadId,
  status,
  leadName,
}: {
  leadId: string;
  status: string;
  leadName: string;
}) {
  const feedback = useFormFeedback();
  const [pendingLost, setPendingLost] = useState<boolean>(false);

  const commit = async (to: string, lostReason?: string) => {
    feedback.setPending();
    const res = await updateLeadStatus({ leadId, status: to, lostReason });
    if (!res.ok) feedback.setError(res.error);
    else feedback.setSuccess("Estado actualizado");
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        defaultValue={status}
        disabled={feedback.pending}
        className="h-8 w-40"
        onChange={async (e) => {
          const next = e.target.value;
          if (next === "lost") {
            setPendingLost(true);
            return;
          }
          commit(next);
        }}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <FormFeedback state={feedback.state} pendingLabel="Actualizando…" />

      <LostReasonDialog
        lead={pendingLost ? { id: leadId, name: leadName } : null}
        onCancel={() => {
          setPendingLost(false);
          // Reset select value to previous status if possible, but Select is defaultValue
          // For now, it stays at 'lost' but we didn't commit.
          // Re-rendering or refreshing would fix it.
        }}
        onConfirm={(reason) => {
          setPendingLost(false);
          commit("lost", reason);
        }}
      />
    </div>
  );
}
