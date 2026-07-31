"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { sendToAeat } from "../actions";

export function SendAeatButton({
  invoiceId,
  disabled,
  label = "Enviar a AEAT",
}: {
  invoiceId: string;
  disabled?: boolean;
  label?: string;
}) {
  const router = useRouter();
  const feedback = useFormFeedback();

  async function onClick() {
    const fd = new FormData();
    fd.set("id", invoiceId);
    feedback.setPending();
    const result = await sendToAeat(fd);
    if (result.ok) {
      feedback.setSuccess(result.csv ? `Aceptada · CSV ${result.csv}` : "Factura procesada");
      router.refresh();
    } else {
      feedback.setError(result.error || "Error técnico al enviar a VERI*FACTU");
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-2">
      <FormFeedback state={feedback.state} pendingLabel="Enviando…" />
      <Button
        type="button"
        size="sm"
        variant="default"
        className="w-full justify-center whitespace-nowrap sm:w-auto"
        disabled={disabled || feedback.pending}
        onClick={onClick}
      >
        <Send className="size-4" />
        {feedback.pending ? "Enviando…" : label}
      </Button>
    </div>
  );
}
