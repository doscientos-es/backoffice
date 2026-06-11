"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type * as React from "react";

interface ConfirmDialogProps {
  /** Controlled open state. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button with the destructive variant. */
  destructive?: boolean;
  /** Disables both buttons while the action runs. */
  pending?: boolean;
  onConfirm: () => void;
}

/**
 * Accessible, theme-aware confirmation dialog built on the shared Radix
 * `Dialog`. Reserved for IRREVERSIBLE or fiscally sensitive actions (e.g.
 * deleting an invoice, hard-deleting documentation, reverting a payment).
 * Reversible soft-deletes should instead use the optimistic delete + undo
 * toast pattern (`useUndoableDelete`).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  pending = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            size="sm"
            disabled={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
