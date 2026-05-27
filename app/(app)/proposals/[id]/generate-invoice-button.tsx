"use client";

import { Button } from "@/components/ui/button";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { createInvoiceFromProposal } from "../../invoices/actions";

type Props = {
  proposalId: string;
};

/**
 * Clone an accepted proposal into a draft invoice and navigate to the new
 * invoice so the user can adjust dates and fiscal data before issuing.
 */
export function GenerateInvoiceButton({ proposalId }: Props) {
  const router = useRouter();
  const feedback = useFormFeedback({ successResetMs: 4000 });
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    feedback.setPending();
    startTransition(async () => {
      const res = await createInvoiceFromProposal({ proposalId });
      if (!res.ok) {
        feedback.setError(res.error);
        return;
      }
      feedback.setSuccess("Factura creada");
      router.push(`/invoices/${res.id}`);
    });
  };

  return (
    <div className="flex items-center gap-3">
      <FormFeedback state={feedback.state} pendingLabel="Generando…" />
      <Button type="button" size="sm" variant="secondary" onClick={handleClick} disabled={pending}>
        <FileText aria-hidden /> Generar factura
      </Button>
    </div>
  );
}
