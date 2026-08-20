"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useFormFeedback } from "@/components/ui/form-feedback";
import { userVerificationScope } from "@/lib/security/user-verification-scope";
import { verifyWithPasskey } from "@/lib/security/webauthn-client";
import { regularizeVerifactu } from "../actions";

/**
 * Recovery action for a record confirmed absent from AEAT. It deliberately
 * asks for confirmation because it appends a new immutable fiscal record.
 */
export function RegularizeAeatButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const feedback = useFormFeedback();
  const [pending, setPending] = useState(false);

  async function onClick() {
    const confirmed = window.confirm(
      "Confirma que AEAT no tiene registrado este alta. Se conservará el intento original y se generará un nuevo alta de subsanación con el certificado actual.",
    );
    if (!confirmed) return;

    feedback.setPending();
    setPending(true);
    const verification = await verifyWithPasskey(
      userVerificationScope("invoice.verifactu_regularize", `invoice:${invoiceId}`),
    );
    if (!verification.ok) {
      setPending(false);
      feedback.setError(verification.error);
      return;
    }

    const fd = new FormData();
    fd.set("id", invoiceId);
    const result = await regularizeVerifactu(fd);
    setPending(false);
    if (result.ok) {
      if (result.status === "accepted") {
        feedback.setSuccess(result.csv ? `Aceptada · CSV ${result.csv}` : "Aceptada por AEAT");
      } else {
        feedback.setError(result.error ?? "La regularización quedó pendiente de envío.");
      }
      router.refresh();
      return;
    }
    feedback.setError(result.error);
    router.refresh();
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="w-full justify-center whitespace-nowrap"
      disabled={pending || feedback.pending}
      onClick={onClick}
    >
      <RotateCcw className="size-4" />
      {pending ? "Regularizando…" : "Regularizar y enviar"}
    </Button>
  );
}
