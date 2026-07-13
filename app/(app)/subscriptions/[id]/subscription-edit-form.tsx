"use client";

import { FormFeedback } from "@/components/ui/form-feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/lib/hooks/use-action-form";
import { updateSubscription } from "../actions";
import { SubscriptionFormFields, type SubscriptionFormValues } from "../subscription-form-fields";

type Props = {
  id: string;
  clients: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  defaults: SubscriptionFormValues;
};

/**
 * Client wrapper around the subscription edit form. Uses `useActionForm` so
 * validation errors and success feedback are surfaced inline — no redirect.
 */
export function SubscriptionEditForm({ id, clients, projects, defaults }: Props) {
  const { state, pending, onSubmit } = useActionForm(
    async (fd) => {
      fd.append("id", id);
      return updateSubscription(fd);
    },
    { successMessage: "Cambios guardados" },
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <SubscriptionFormFields clients={clients} projects={projects} defaults={defaults} />
      <div className="flex items-center justify-end gap-3">
        <FormFeedback state={state} />
        <SubmitButton loading={pending}>Guardar cambios</SubmitButton>
      </div>
    </form>
  );
}
