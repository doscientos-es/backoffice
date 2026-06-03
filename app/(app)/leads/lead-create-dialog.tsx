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
import { Plus } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { createLead } from "./actions";
import { LeadFormFields } from "./lead-form-fields";

interface Props {
  /** Custom trigger element. Defaults to a "Nuevo lead" button. */
  trigger?: ReactNode;
  /** Callback fired after successful lead creation. */
  onCreated?: (id: string) => void;
}

/**
 * Dialog for creating a new lead without navigating away.
 */
export function LeadCreateDialog({ trigger, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const feedback = useFormFeedback();
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    feedback.setPending();
    const fd = new FormData(e.currentTarget);
    const estimatedRaw = fd.get("estimated_value")?.toString() ?? "";
    const estimated_value = estimatedRaw === "" ? null : Number(estimatedRaw);

    const res = await createLead({
      name: fd.get("name")?.toString() ?? "",
      company: fd.get("company")?.toString() ?? "",
      email: fd.get("email")?.toString() ?? "",
      phone: fd.get("phone")?.toString() ?? "",
      source: fd.get("source")?.toString() ?? "",
      notes: fd.get("notes")?.toString() ?? "",
      estimated_value,
    });

    if (!res.ok) return feedback.setError(res.error);

    feedback.setSuccess("Lead creado");
    formRef.current?.reset();
    onCreated?.(res.id);
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
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" aria-hidden />
            Nuevo lead
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo lead</DialogTitle>
          <DialogDescription>
            Registra una nueva oportunidad comercial.
          </DialogDescription>
        </DialogHeader>
        <form
          ref={formRef}
          onSubmit={onSubmit}
          className="flex flex-col gap-5 max-h-[80vh] overflow-y-auto pr-1"
        >
          <LeadFormFields idPrefix="create" includeEstimatedValue autoFocusName />
          <div className="flex items-center justify-end gap-3 border-t border-border pt-3">
            <FormFeedback state={feedback.state} pendingLabel="Creando…" />
            <SubmitButton loading={feedback.pending} pendingLabel="Creando…">
              Crear lead
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
