"use client";

import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { useRouter } from "next/navigation";
import { createLead } from "../actions";
import { LeadFormFields } from "../lead-form-fields";

/**
 * Standalone lead-creation form for `/leads/new`.
 */
export function LeadNewForm() {
  const router = useRouter();
  const feedback = useFormFeedback();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    feedback.setPending();
    const fd = new FormData(e.currentTarget);
    const estimatedRaw = fd.get("estimated_value")?.toString() ?? "";
    const estimated_value = estimatedRaw === "" ? null : Number(estimatedRaw);

    const res = await createLead({
      name: fd.get("name")?.toString() ?? "",
      alias: fd.get("alias")?.toString() ?? "",
      company: fd.get("company")?.toString() ?? "",
      email: fd.get("email")?.toString() ?? "",
      phone: fd.get("phone")?.toString() ?? "",
      source: fd.get("source")?.toString() ?? "",
      notes: fd.get("notes")?.toString() ?? "",
      estimated_value,
      company_size: fd.get("company_size")?.toString() ?? "",
      solution_type: fd.get("solution_type")?.toString() ?? "",
      urgency: fd.get("urgency")?.toString() ?? "",
    });

    if (!res.ok) return feedback.setError(res.error);
    router.push(`/leads/${res.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <LeadFormFields idPrefix="new" includeEstimatedValue autoFocusName />
      <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
        <FormFeedback state={feedback.state} pendingLabel="Creando…" />
        <SubmitButton loading={feedback.pending} pendingLabel="Creando…">
          Crear lead
        </SubmitButton>
      </div>
    </form>
  );
}
