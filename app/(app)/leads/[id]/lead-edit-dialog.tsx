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
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { updateLead } from "../actions";

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
    setTimeout(() => setOpen(false), 400);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FormRow label="Nombre" htmlFor="e_name" required>
            <Input
              id="e_name"
              name="name"
              defaultValue={lead.name}
              required
              maxLength={160}
              placeholder="Nombre y apellidos"
              autoComplete="name"
            />
          </FormRow>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow label="Empresa" htmlFor="e_company">
              <Input
                id="e_company"
                name="company"
                defaultValue={lead.company ?? ""}
                maxLength={160}
                placeholder="Acme S.L."
                autoComplete="organization"
              />
            </FormRow>
            <FormRow label="Email" htmlFor="e_email">
              <Input
                id="e_email"
                name="email"
                type="email"
                inputMode="email"
                defaultValue={lead.email ?? ""}
                maxLength={160}
                placeholder="nombre@ejemplo.com"
                autoComplete="email"
              />
            </FormRow>
            <FormRow label="Teléfono" htmlFor="e_phone">
              <Input
                id="e_phone"
                name="phone"
                type="tel"
                inputMode="tel"
                defaultValue={lead.phone ?? ""}
                maxLength={40}
                placeholder="+34 600 000 000"
                autoComplete="tel"
              />
            </FormRow>
            <FormRow label="Origen" htmlFor="e_source">
              <Input
                id="e_source"
                name="source"
                defaultValue={lead.source ?? ""}
                maxLength={80}
                placeholder="Web, referido…"
              />
            </FormRow>
            <FormRow label="Valor estimado (€)" htmlFor="e_estimated_value">
              <Input
                id="e_estimated_value"
                name="estimated_value"
                type="number"
                inputMode="decimal"
                min={0}
                max={99999999.99}
                step="0.01"
                defaultValue={lead.estimated_value != null ? String(lead.estimated_value) : ""}
                placeholder="0.00"
              />
            </FormRow>
          </div>
          <FormRow label="Notas" htmlFor="e_notes" hint="Información interna sobre el lead.">
            <Textarea
              id="e_notes"
              name="notes"
              rows={3}
              maxLength={4000}
              defaultValue={lead.notes ?? ""}
              placeholder="Observaciones, contexto…"
            />
          </FormRow>
          <div className="flex items-center justify-end gap-3 border-t border-border pt-3">
            <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
            <SubmitButton loading={feedback.pending} pendingLabel="Guardando…">
              Guardar cambios
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
