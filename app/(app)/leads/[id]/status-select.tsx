"use client";

import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Select } from "@/components/ui/select";
import type { LeadStatusType } from "@/lib/schemas/lead";
import { useState } from "react";
import { updateLeadStatus } from "../actions";
import { CloseReasonDialog, type CloseReasonVariant } from "../close-reason-dialog";

const OPTIONS = [
  { value: "new", label: "Nuevo" },
  { value: "qualifying", label: "En cualificación" },
  { value: "quoted", label: "Presupuestado" },
  { value: "won", label: "Ganado" },
  { value: "lost", label: "Perdido" },
  { value: "not_interested", label: "No interesa" },
  { value: "archived", label: "Archivado" },
] as const;

const CLOSURE_VARIANTS: Record<string, CloseReasonVariant> = {
  lost: "lost",
  not_interested: "not_interested",
};

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
  const [pendingClosure, setPendingClosure] = useState<CloseReasonVariant | null>(null);

  const commit = async (to: LeadStatusType, lostReason?: string) => {
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
          const next = e.target.value as LeadStatusType;
          const variant = CLOSURE_VARIANTS[next];
          if (variant) {
            setPendingClosure(variant);
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

      <CloseReasonDialog
        lead={pendingClosure ? { id: leadId, name: leadName } : null}
        variant={pendingClosure ?? "lost"}
        onCancel={() => setPendingClosure(null)}
        onConfirm={(reason) => {
          if (!pendingClosure) return;
          const next = pendingClosure;
          setPendingClosure(null);
          commit(next, reason);
        }}
      />
    </div>
  );
}
