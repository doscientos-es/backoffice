"use client";

import { Button } from "@/components/ui/button";
import type { VendorSuggestion } from "@/lib/finance/types";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createExpense } from "../actions";
import { type ExpenseFormDefaults, ExpenseFormFields } from "../expense-form-fields";

interface Props {
  projects: Array<{ id: string; name: string; clientName?: string | null }>;
  teamMembers: Array<{ id: string; name: string }>;
  defaults?: ExpenseFormDefaults;
  vendorSuggestions?: VendorSuggestion[];
}

export function NewExpenseForm({ projects, teamMembers, defaults, vendorSuggestions }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await createExpense(fd);
      if (res && !res.ok) {
        setError(res.error);
      }
      // On success, createExpense redirects — nothing else needed.
    } catch {
      // redirect() throws internally in Next.js; let it propagate
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <ExpenseFormFields
        autoFocusVendor
        projects={projects}
        teamMembers={teamMembers}
        defaults={defaults}
        vendorSuggestions={vendorSuggestions}
      />
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end border-t border-border pt-4">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Creando…" : "Crear gasto"}
        </Button>
      </div>
    </form>
  );
}
