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
import { type ReactNode, useState } from "react";
import { updateClient } from "../actions";
import { ClientFormFields } from "../client-form-fields";

type Client = {
  id: string;
  name: string;
  label: string | null;
  nif: string | null;
  email: string | null;
  phone: string | null;
  contact_person: string | null;
  billing_address_street: string | null;
  billing_address_zip: string | null;
  billing_address_city: string | null;
  billing_address_province: string | null;
  billing_address_country: string | null;
  notes: string | null;
  logo_url: string | null;
};

export function ClientEditDialog({
  client,
  trigger,
}: {
  client: Client;
  /** Custom trigger element. Defaults to the standard "Editar" button. */
  trigger?: ReactNode;
}) {
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
      label: fd.get("label")?.toString() ?? "",
      nif: fd.get("nif")?.toString() ?? "",
      email: fd.get("email")?.toString() ?? "",
      phone: fd.get("phone")?.toString() ?? "",
      billing_address_street: fd.get("billing_address_street")?.toString() ?? "",
      billing_address_zip: fd.get("billing_address_zip")?.toString() ?? "",
      billing_address_city: fd.get("billing_address_city")?.toString() ?? "",
      billing_address_province: fd.get("billing_address_province")?.toString() ?? "",
      billing_address_country: fd.get("billing_address_country")?.toString() ?? "ES",
      contact_person: fd.get("contact_person")?.toString() ?? "",
      notes: fd.get("notes")?.toString() ?? "",
      logo_url: fd.get("logo_url")?.toString() ?? "",
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
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Pencil className="size-4" aria-hidden />
            Editar
          </Button>
        )}
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
                label: client.label,
                nif: client.nif,
                email: client.email,
                phone: client.phone,
                contact_person: client.contact_person,
                billing_address_street: client.billing_address_street,
                billing_address_zip: client.billing_address_zip,
                billing_address_city: client.billing_address_city,
                billing_address_province: client.billing_address_province,
                billing_address_country: client.billing_address_country,
                notes: client.notes,
                logo_url: client.logo_url,
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
