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
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormDirty } from "@/lib/hooks/use-form-dirty";
import type { MemberOption } from "@/lib/members/queries";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { sileo } from "sileo";
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
  company_size: string | null;
  solution_type: string | null;
  urgency: string | null;
  assigned_to: string | null;
};

export function LeadEditDialog({ lead, members = [] }: { lead: Lead; members?: MemberOption[] }) {
  const [open, setOpen] = useState(false);
  const { formRef, isDirty, reset } = useFormDirty<HTMLFormElement>();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const estimatedRaw = fd.get("estimated_value")?.toString() ?? "";
    const payload = {
      id: lead.id,
      name: fd.get("name")?.toString() ?? "",
      email: fd.get("email")?.toString() ?? "",
      phone: fd.get("phone")?.toString() ?? "",
      company: fd.get("company")?.toString() ?? "",
      source: fd.get("source")?.toString() ?? "",
      notes: fd.get("notes")?.toString() ?? "",
      estimated_value: estimatedRaw === "" ? null : Number(estimatedRaw),
      company_size: fd.get("company_size")?.toString() ?? "",
      solution_type: fd.get("solution_type")?.toString() ?? "",
      urgency: fd.get("urgency")?.toString() ?? "",
      assigned_to: fd.get("assigned_to")?.toString() ?? "",
    };
    // Close immediately (optimistic) — server revalidatePath updates the page.
    reset();
    setOpen(false);
    const res = await updateLead(payload);
    if (!res.ok) sileo.error({ title: res.error ?? "No se pudo guardar el lead" });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" aria-hidden />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar lead</DialogTitle>
          <DialogDescription>Actualiza los datos del lead.</DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={onSubmit} className="flex flex-col max-h-[80vh]">
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 flex flex-col gap-5">
            <LeadFormFields
              idPrefix={`edit-${lead.id}`}
              includeEstimatedValue
              members={members}
              defaults={{
                name: lead.name,
                company: lead.company,
                email: lead.email,
                phone: lead.phone,
                source: lead.source,
                notes: lead.notes,
                estimated_value: lead.estimated_value,
                company_size: lead.company_size,
                solution_type: lead.solution_type,
                urgency: lead.urgency,
                assigned_to: lead.assigned_to,
              }}
            />
          </div>
          <div className="shrink-0 flex items-center justify-end gap-3 border-t border-border pt-3">
            <SubmitButton disabled={!isDirty}>Guardar cambios</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
