"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ReopenConfirmDialog({
  lead,
  onCancel,
  onConfirm,
}: {
  lead: { id: string; name: string } | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={!!lead} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reabrir oportunidad</DialogTitle>
          <DialogDescription>
            <strong>{lead?.name}</strong> ya estaba ganado. ¿Quieres reabrir esta
            oportunidad como un nuevo ciclo de ventas?
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button size="sm" onClick={onConfirm}>
            Sí, reabrir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
