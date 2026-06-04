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
import { updateExpense } from "../actions";
import { ExpenseFormFields, type VendorSuggestion } from "../expense-form-fields";

type Expense = {
  id: string;
  vendor: string;
  description: string | null;
  category: string;
  status: string;
  recurrence: string;
  expense_date: string;
  due_date: string | null;
  paid_at: string | null;
  currency: string;
  subtotal: number | string;
  tax_rate: number | string;
  vendor_nif: string | null;
  invoice_reference: string | null;
  project_id: string | null;
  notes: string | null;
  payment_source?: string | null;
  paid_by_member_id?: string | null;
};

interface Props {
  expense: Expense;
  projects: Array<{ id: string; name: string; clientName?: string | null }>;
  teamMembers?: Array<{ id: string; name: string }>;
  vendorSuggestions?: VendorSuggestion[];
  /** Controlled open state (used when triggered from the list kebab menu). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the built-in "Editar" trigger when opened externally. */
  hideTrigger?: boolean;
}

export function ExpenseEditDialog({
  expense,
  projects,
  teamMembers = [],
  vendorSuggestions = [],
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };
  const feedback = useFormFeedback();
  const { formRef, isDirty, reset } = useFormDirty<HTMLFormElement>();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    feedback.setPending();
    const fd = new FormData(e.currentTarget);
    const res = await updateExpense({
      id: expense.id,
      vendor: fd.get("vendor")?.toString() ?? "",
      description: fd.get("description")?.toString() ?? "",
      category: fd.get("category")?.toString() ?? "other",
      status: fd.get("status")?.toString() ?? "paid",
      recurrence: fd.get("recurrence")?.toString() ?? "none",
      expense_date: fd.get("expense_date")?.toString() ?? "",
      due_date: fd.get("due_date")?.toString() ?? "",
      paid_at: fd.get("paid_at")?.toString() ?? "",
      currency: fd.get("currency")?.toString() ?? "EUR",
      subtotal: fd.get("subtotal")?.toString() ?? "0",
      tax_rate: fd.get("tax_rate")?.toString() ?? "21",
      vendor_nif: fd.get("vendor_nif")?.toString() ?? "",
      invoice_reference: fd.get("invoice_reference")?.toString() ?? "",
      project_id: fd.get("project_id")?.toString() ?? "",
      notes: fd.get("notes")?.toString() ?? "",
      payment_source: fd.get("payment_source")?.toString() ?? "company",
      paid_by_member_id: fd.get("paid_by_member_id")?.toString() ?? "",
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
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Pencil className="size-4" aria-hidden />
            Editar
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Editar gasto</DialogTitle>
          <DialogDescription>Actualiza los datos del gasto.</DialogDescription>
        </DialogHeader>
        <form
          ref={formRef}
          onSubmit={onSubmit}
          className="flex flex-col max-h-[70vh]"
        >
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-5">
            <ExpenseFormFields
              idPrefix={`edit-${expense.id}`}
              projects={projects}
              teamMembers={teamMembers}
              vendorSuggestions={vendorSuggestions}
              defaults={{
                vendor: expense.vendor,
                description: expense.description,
                category: expense.category,
                status: expense.status,
                recurrence: expense.recurrence,
                expense_date: expense.expense_date.slice(0, 10),
                due_date: expense.due_date?.slice(0, 10) ?? "",
                paid_at: expense.paid_at?.slice(0, 10) ?? "",
                currency: expense.currency,
                subtotal: Number(expense.subtotal ?? 0),
                tax_rate: Number(expense.tax_rate ?? 0),
                vendor_nif: expense.vendor_nif,
                invoice_reference: expense.invoice_reference,
                project_id: expense.project_id,
                notes: expense.notes,
                payment_source: expense.payment_source,
                paid_by_member_id: expense.paid_by_member_id,
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
