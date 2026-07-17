"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmailComposer } from "./[id]/email-composer";

type Props = {
  leadId: string;
  leadName: string;
  leadEmail: string | null;
  aiEnabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftKey: number;
};

/**
 * Follow-up composer shown after a call is logged. Nothing is sent until the
 * operator reviews and submits the email from the shared composer.
 */
export function CallDigestDialog({
  leadId,
  leadName,
  leadEmail,
  aiEnabled,
  open,
  onOpenChange,
  draftKey,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar resumen de la llamada</DialogTitle>
          <DialogDescription>
            La llamada con {leadName} se ha registrado. Revisa el borrador antes de enviarlo.
          </DialogDescription>
        </DialogHeader>
        <EmailComposer
          key={draftKey}
          leadId={leadId}
          defaultTo={leadEmail ?? ""}
          defaultSubject="Resumen de nuestra llamada · {{nombre}}"
          disabled={!leadEmail}
          disabledReason="Este lead no tiene email registrado. Puedes añadirlo desde la ficha del lead."
          aiEnabled={aiEnabled}
          draftKind="call_digest"
          draftInstructions="Redacta un resumen posterior a la llamada. Incluye los temas tratados, acuerdos y próximos pasos que aparezcan en las notas o transcripción. No menciones notas internas, IA ni la transcripción como tal y no inventes información. Tono profesional, cercano y accionable."
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
