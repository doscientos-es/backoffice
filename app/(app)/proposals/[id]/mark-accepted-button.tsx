"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { markProposalAsAccepted } from "../actions";

/**
 * Lets team members mark a proposal as accepted manually — for cases where
 * the client accepted in person or by phone without going through the portal.
 */
export function MarkAcceptedButton({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const feedback = useFormFeedback({ successResetMs: 3000 });
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    feedback.setPending();
    startTransition(async () => {
      const res = await markProposalAsAccepted({ id: proposalId });
      if (!res.ok) {
        feedback.setError(res.error);
        return;
      }
      feedback.setSuccess("Propuesta aceptada");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CheckCheck aria-hidden /> Marcar como aceptada
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar como aceptada</DialogTitle>
          <DialogDescription>
            Confirma que el cliente ha aceptado esta propuesta fuera del portal (en persona, por
            teléfono, etc.). Esto bloqueará la edición y habilitará la generación de facturas.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex items-center gap-2">
          <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={pending}>
            {pending ? "Guardando…" : "Confirmar aceptación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
