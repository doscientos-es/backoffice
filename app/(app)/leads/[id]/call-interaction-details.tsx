"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MemberLabel } from "@/components/ui/member-avatar";
import { getCallInteractionDetails } from "@/lib/leads/interaction-utils";
import type { LeadDetailInteraction } from "@/lib/leads/types";
import { Eye, FileText } from "lucide-react";
import { useState } from "react";

const CALL_OUTCOME_LABEL: Record<string, string> = {
  connected: "Contactado",
  voicemail: "Buzón de voz",
  no_answer: "Sin respuesta",
  busy: "Comunicando",
  wrong_number: "Número erróneo",
};

export function CallInteractionDetails({
  interaction,
}: {
  interaction: LeadDetailInteraction;
}) {
  const [open, setOpen] = useState(false);
  const details = getCallInteractionDetails(interaction.payload);
  const hasNotes = Boolean(interaction.body?.trim());
  const hasTranscript = Boolean(details.transcript);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-6 shrink-0 gap-1 px-2 text-xs text-muted-foreground"
        >
          <Eye className="size-3" />
          Ver detalles
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{interaction.subject ?? "Llamada"}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <span>{new Date(interaction.created_at).toLocaleString("es-ES")}</span>
            {interaction.performer ? (
              <MemberLabel member={interaction.performer} size="xs" />
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
          <div className="flex flex-wrap gap-2">
            {details.outcome ? (
              <Badge variant="neutral">
                {CALL_OUTCOME_LABEL[details.outcome] ?? details.outcome}
              </Badge>
            ) : null}
            {details.durationMinutes != null ? (
              <Badge variant="outline">{details.durationMinutes} min</Badge>
            ) : null}
          </div>

          {hasNotes ? (
            <section className="space-y-1.5">
              <h3 className="text-xs font-medium text-muted-foreground">Notas</h3>
              <p className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">
                {interaction.body}
              </p>
            </section>
          ) : null}

          {hasTranscript ? (
            <section className="space-y-1.5">
              <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <FileText className="size-3.5" />
                Transcripción completa
              </h3>
              <p className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
                {details.transcript}
              </p>
            </section>
          ) : null}

          {!hasNotes && !hasTranscript ? (
            <p className="text-sm text-muted-foreground">
              Esta llamada no tiene notas ni transcripción.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
