"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useFormFeedback } from "@/components/ui/form-feedback";
import { userVerificationScope } from "@/lib/security/user-verification-scope";
import { verifyWithPasskey } from "@/lib/security/webauthn-client";
import { sendToAeat } from "../actions";
import { VerifactuIssueDialog } from "./verifactu-issue-dialog";

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
  const [issue, setIssue] = useState<{ error: string; status: "error" | "rejected" } | null>(null);

  function showIssue(error: string, status: "error" | "rejected" = "error") {
    setIssue({ error, status });
  }

  async function onClick() {
    feedback.setPending();
    const verification = await verifyWithPasskey(
      userVerificationScope("invoice.send_aeat", `invoice:${invoiceId}`),
    );
    if (!verification.ok) {
      feedback.setError(verification.error);
      showIssue(verification.error);
      return;
    }
    const fd = new FormData();
    fd.set("id", invoiceId);
    const result = await sendToAeat(fd);
    if (result.ok) {
      if (result.status === "accepted") {
        feedback.setSuccess(result.csv ? `Aceptada · CSV ${result.csv}` : "Aceptada por AEAT");
      } else if (result.status === "rejected") {
        feedback.setError(
          "AEAT rechazó el registro. Consulta el motivo fiscal antes de continuar.",
        );
        showIssue(
          "AEAT rechazó el registro. Consulta el motivo fiscal antes de continuar.",
          "rejected",
        );
      } else if (result.status === "error") {
        feedback.setError("El envío a AEAT falló; se reintentará automáticamente.");
        showIssue("El envío a AEAT falló; se reintentará automáticamente.");
      } else {
        feedback.setSuccess("El registro fiscal ya está siendo gestionado.");
      }
      router.refresh();
    } else {
      feedback.setError(result.error);
      showIssue(result.error);
      router.refresh();
    }
  }

  return (
    <div className="col-span-2 flex min-w-0 w-full sm:w-auto">
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
      {issue ? (
        <VerifactuIssueDialog
          open
          status={issue.status}
          error={issue.error}
          onOpenChange={(open) => !open && setIssue(null)}
        />
      ) : null}
    </div>
  );
}
