"use client";

import { Button } from "@/components/ui/button";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { createInvoiceFromSubscription } from "../actions";

export function GenerateInvoiceButton({ subscriptionId }: { subscriptionId: string }) {
  const router = useRouter();
  const feedback = useFormFeedback({ successResetMs: 4000 });
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    feedback.setPending();
    startTransition(async () => {
      const res = await createInvoiceFromSubscription({ id: subscriptionId });
      if (!res.ok) {
        feedback.setError(res.error);
        return;
      }
      feedback.setSuccess("Factura creada");
      router.push(`/invoices/${res.id}`);
    });
  };

  return (
    <div className="flex items-center gap-2">
      {/* FormFeedback shows the spinner + label while pending; the button text stays static */}
      <FormFeedback state={feedback.state} pendingLabel="Generando…" />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending || feedback.pending}
        onClick={handleClick}
      >
        <FileText className="size-4" />
        Generar factura
      </Button>
    </div>
  );
}
