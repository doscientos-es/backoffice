"use client";

import { TriangleAlert as AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type VerifactuIssueStatus = "error" | "rejected";

const issueCopy = {
  error: {
    title: "Error técnico de VERI*FACTU",
    trigger: "Ver detalle",
    guidance:
      "El sistema volverá a intentarlo automáticamente. Puedes reintentar el envío desde la cabecera si lo necesitas.",
  },
  rejected: {
    title: "Factura rechazada por AEAT",
    trigger: "Ver detalle",
    guidance:
      "Revisa el motivo fiscal antes de volver a enviar el registro o aplicar el procedimiento correspondiente.",
  },
} as const;

export function VerifactuIssueDialog({
  status,
  error,
  open,
  onOpenChange,
}: {
  status: VerifactuIssueStatus;
  error: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <VerifactuIssueDialogContent status={status} error={error} />
    </Dialog>
  );
}

export function VerifactuIssueDetailsButton({
  status,
  error,
}: {
  status: VerifactuIssueStatus;
  error: string | null;
}) {
  const copy = issueCopy[status];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="xs"
          variant="destructive"
          className="max-w-full"
          aria-label={`Ver detalle de ${copy.title}`}
        >
          <AlertTriangle className="size-3" aria-hidden />
          <span className="truncate">{copy.trigger}</span>
        </Button>
      </DialogTrigger>
      <VerifactuIssueDialogContent status={status} error={error} />
    </Dialog>
  );
}

function VerifactuIssueDialogContent({
  status,
  error,
}: {
  status: VerifactuIssueStatus;
  error: string | null;
}) {
  const copy = issueCopy[status];

  return (
    <DialogContent className="min-w-0 sm:max-w-lg">
      <DialogHeader className="min-w-0">
        <DialogTitle className="flex min-w-0 items-center gap-2">
          <AlertTriangle className="size-5 shrink-0 text-destructive" aria-hidden />
          <span className="truncate">{copy.title}</span>
        </DialogTitle>
        <DialogDescription>{copy.guidance}</DialogDescription>
      </DialogHeader>

      {error ? (
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Detalle técnico</p>
          <pre className="max-h-56 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap wrap-break-word text-foreground">
            {error}
          </pre>
        </div>
      ) : null}

      <DialogFooter>
        <DialogClose asChild>
          <Button size="sm" variant="outline">
            Cerrar
          </Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  );
}
