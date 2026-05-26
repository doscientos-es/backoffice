"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useState } from "react";

const LOST_REASON_PRESETS = [
  "Precio",
  "Timing / Calendario",
  "Eligió competencia",
  "No es buen fit",
  "Sin respuesta",
  "Sin presupuesto",
  "Duplicado",
] as const;

export function LostReasonDialog({
  lead,
  onCancel,
  onConfirm,
}: {
  lead: { id: string; name: string } | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState("");

  const reason = (selected ?? custom).trim();
  const open = !!lead;

  const reset = () => {
    setSelected(null);
    setCustom("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          reset();
          onCancel();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar como perdido</DialogTitle>
          <DialogDescription>
            {lead ? `¿Por qué se ha perdido ${lead.name}?` : "Indica un motivo"}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {LOST_REASON_PRESETS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setSelected(r);
                setCustom("");
              }}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                selected === r
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <Textarea
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value);
            if (e.target.value) setSelected(null);
          }}
          placeholder="O escribe un motivo personalizado…"
          rows={3}
          maxLength={500}
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              onCancel();
            }}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!reason}
            onClick={() => {
              if (!reason) return;
              onConfirm(reason);
              reset();
            }}
          >
            Marcar perdido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
