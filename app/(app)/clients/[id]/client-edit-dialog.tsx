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
import { updateClient } from "../actions";
import { ClientFormFields } from "../client-form-fields";

type Client = {
  id: string;
  name: string;
  nif: string | null;
  email: string | null;
  phone: string | null;
  contact_person: string | null;
  billing_address: string | null;
  notes: string | null;
};

export function ClientEditDialog({ client }: { client: Client }) {
  const [open, setOpen] = useState(false);
  const feedback = useFormFeedback();
  const { formRef, isDirty, reset } = useFormDirty<HTMLFormElement>();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    feedback.setPending();
    const fd = new FormData(e.currentTarget);
    const res = await updateClient({
      id: client.id,
      name: fd.get("name")?.toString() ?? "",
      nif: fd.get("nif")?.toString() ?? "",
      email: fd.get("email")?.toString() ?? "",
      phone: fd.get("phone")?.toString() ?? "",
      billing_address: fd.get("billing_address")?.toString() ?? "",
      contact_person: fd.get("contact_person")?.toString() ?? "",
      notes: fd.get("notes")?.toString() ?? "",
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
          <DialogDescription>Actualiza los datos del cliente.</DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={onSubmit} className="flex flex-col max-h-[70vh]">
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-5">
            <ClientFormFields
              idPrefix={`edit-${client.id}`}
              defaults={{
                name: client.name,
                nif: client.nif,
                email: client.email,
                phone: client.phone,
                contact_person: client.contact_person,
                billing_address: client.billing_address,
                notes: client.notes,
              }}
            />
          </div>
          <div className="shrink-0 flex items-center justify-end gap-3 border-t border-border pt-3">
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
