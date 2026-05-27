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
import { Pencil } from "lucide-react";
import { useState } from "react";
import { updateLead } from "../actions";
import { LeadFormFields } from "../lead-form-fields";

type Lead = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  notes: string | null;
  estimated_value: number | null;
};

export function LeadEditDialog({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false);
  const feedback = useFormFeedback();
  const { formRef, isDirty, reset } = useFormDirty<HTMLFormElement>();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    feedback.setPending();
    const fd = new FormData(e.currentTarget);
    const res = await updateLead({
      id: lead.id,
      name: fd.get("name")?.toString() ?? "",
      email: fd.get("email")?.toString() ?? "",
      phone: fd.get("phone")?.toString() ?? "",
      company: fd.get("company")?.toString() ?? "",
      source: fd.get("source")?.toString() ?? "",
      notes: fd.get("notes")?.toString() ?? "",
      estimated_value: fd.get("estimated_value")?.toString() ?? "",
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar lead</DialogTitle>
          <DialogDescription>Actualiza los datos del lead.</DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-5">
          <LeadFormFields
            idPrefix={`edit-${lead.id}`}
            includeEstimatedValue
            defaults={{
              name: lead.name,
              company: lead.company,
              email: lead.email,
              phone: lead.phone,
              source: lead.source,
              notes: lead.notes,
              estimated_value: lead.estimated_value,
            }}
          />
          <div className="flex items-center justify-end gap-3 border-t border-border pt-3">
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
