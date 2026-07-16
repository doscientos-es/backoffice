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
import { FormFeedback } from "@/components/ui/form-feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/lib/hooks/use-action-form";
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
  const { formRef, isDirty, markDirty, reset: resetDirty } = useFormDirty<HTMLFormElement>();
  const {
    state,
    pending,
    onSubmit,
    reset: resetFeedback,
  } = useActionForm(updateExpense, {
    successMessage: "Guardado",
    onSuccess: () => {
      resetDirty();
      setTimeout(() => setOpen(false), 400);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetFeedback();
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
        <form ref={formRef} onSubmit={onSubmit} className="flex flex-col max-h-[70vh]">
          <input type="hidden" name="id" value={expense.id} />
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-5 scroll-fade no-scrollbar">
            <ExpenseFormFields
              idPrefix={`edit-${expense.id}`}
              projects={projects}
              teamMembers={teamMembers}
              vendorSuggestions={vendorSuggestions}
              onProjectIdChange={markDirty}
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
            <FormFeedback state={state} pendingLabel="Guardando…" />
            <SubmitButton loading={pending} disabled={!isDirty} pendingLabel="Guardando…">
              Guardar cambios
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
