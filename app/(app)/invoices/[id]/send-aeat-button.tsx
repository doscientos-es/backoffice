"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFormFeedback } from "@/components/ui/form-feedback";
import { userVerificationScope } from "@/lib/security/user-verification-scope";
import {
  completePasskeyAuthentication,
  preparePasskeyAuthentication,
} from "@/lib/security/webauthn-client";
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [passkeyOptions, setPasskeyOptions] = useState<unknown>(null);
  const scope = userVerificationScope("invoice.send_aeat", `invoice:${invoiceId}`);

  function showIssue(error: string, status: "error" | "rejected" = "error") {
    setIssue({ error, status });
  }

  async function prepareVerification() {
    setPreparing(true);
    setPasskeyOptions(null);
    const started = await preparePasskeyAuthentication(scope);
    setPreparing(false);
    if (!started.ok) {
      feedback.setError(started.error);
      return;
    }
    setPasskeyOptions(started.options);
    setConfirmOpen(true);
  }

  async function confirmWithPasskey() {
    if (!passkeyOptions) return;

    // This browser call must start directly from this click so the device
    // authenticator retains user activation after the server challenge was prepared.
    feedback.setPending();
    const verification = await completePasskeyAuthentication(scope, passkeyOptions);
    if (!verification.ok) {
      setConfirmOpen(false);
      feedback.setError(verification.error);
      return;
    }
    setConfirmOpen(false);
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
        const detail = result.error ?? "El envío a AEAT falló; se reintentará automáticamente.";
        feedback.setError(detail);
        showIssue(detail);
      } else if (result.status === "skipped" || result.status === "deferred") {
        const detail = result.error ?? "El registro sigue pendiente de entrega a AEAT.";
        feedback.setError(detail);
        showIssue(detail);
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
    <div className="inline-flex min-w-0">
      <Button
        type="button"
        size="sm"
        variant="default"
        className="justify-center whitespace-nowrap"
        disabled={disabled || preparing || feedback.pending}
        onClick={prepareVerification}
      >
        <Send className="size-4" />
        {preparing ? "Preparando…" : feedback.pending ? "Enviando…" : label}
      </Button>
      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setPasskeyOptions(null);
        }}
      >
        <DialogContent showCloseButton={!feedback.pending}>
          <DialogHeader>
            <DialogTitle>Confirmar reenvío a VERI*FACTU</DialogTitle>
            <DialogDescription>
              Confirma tu identidad para reenviar este registro fiscal a AEAT.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={feedback.pending}
            >
              Cancelar
            </Button>
            <Button onClick={confirmWithPasskey} disabled={feedback.pending}>
              Confirmar con biometría
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
