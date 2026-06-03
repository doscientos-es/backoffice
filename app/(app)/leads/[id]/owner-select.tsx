"use client";

import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Select } from "@/components/ui/select";
import type { MemberOption } from "@/lib/members/queries";
import { assignLeadOwner } from "../actions";

/**
 * Inline owner picker for the lead detail view. Persists immediately via
 * `assignLeadOwner` and surfaces optimistic feedback. The empty option
 * clears the owner ("" → null in the schema).
 */
export function LeadOwnerSelect({
  leadId,
  assignedTo,
  members,
}: {
  leadId: string;
  assignedTo: string | null;
  members: MemberOption[];
}) {
  const feedback = useFormFeedback();

  return (
    <div className="flex items-center gap-2">
      <Select
        defaultValue={assignedTo ?? ""}
        disabled={feedback.pending}
        className="h-8 w-48"
        aria-label="Responsable del lead"
        onChange={async (e) => {
          feedback.setPending();
          const res = await assignLeadOwner({ leadId, assigneeId: e.target.value });
          if (!res.ok) feedback.setError(res.error);
          else feedback.setSuccess("Responsable actualizado");
        }}
      >
        <option value="">Sin asignar</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </Select>
      <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
    </div>
  );
}
