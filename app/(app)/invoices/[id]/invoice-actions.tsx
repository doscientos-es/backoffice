"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { useUndoableDelete } from "@/lib/hooks/use-undoable-delete";
import {
  CheckCircle2,
  Download,
  FileEdit,
  Loader2,
  MoreHorizontal,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteInvoice, restoreInvoice, updateInvoiceStatus } from "../actions";
import { SendAeatButton } from "./send-aeat-button";

/** Builds the `{ id }` FormData both delete and restore invoice actions expect. */
function idFormData(invoiceId: string): FormData {
  const fd = new FormData();
  fd.append("id", invoiceId);
  return fd;
}

interface Props {
  invoice: {
    id: string;
    status: string;
    verifactu_status: string;
  };
}

export function InvoiceActions({ invoice }: Props) {
  const [pending, startTransition] = useTransition();
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const feedback = useFormFeedback();
  const [confirmUncollected, setConfirmUncollected] = useState(false);

  // Soft-delete (reversible via `deleted_at`): frictionless delete with a
  // "Deshacer" toast instead of a blocking confirm dialog.
  const { run: handleDelete, pending: deletePending } = useUndoableDelete({
    successMessage: "Factura eliminada",
    onDelete: () => deleteInvoice(idFormData(invoice.id)),
    onRestore: () => restoreInvoice(idFormData(invoice.id)),
    redirectTo: "/invoices",
  });

  const handleStatusUpdate = (status: "issued" | "paid" | "cancelled", successLabel?: string) => {
    setPendingStatus(status);
    startTransition(async () => {
      feedback.setPending();
      const res = await updateInvoiceStatus({ id: invoice.id, status });
      setPendingStatus(null);
      if (res.ok) {
        feedback.setSuccess(
          successLabel ??
          (status === "issued"
            ? "Factura emitida"
            : status === "paid"
              ? "Factura pagada"
              : "Factura anulada"),
        );
      } else {
        feedback.setError(res.error);
      }
    });
  };

  const isDraft = invoice.status === "draft";
  const isIssued = invoice.status === "issued";
  const isPaid = invoice.status === "paid";
  const isOverdue = invoice.status === "overdue";

  const canEdit = isDraft;
  const canIssue = isDraft;
  const canMarkPaid = isIssued || isOverdue;
  const canMarkUncollected = isPaid;
  const canCancel = isIssued || isOverdue;
  // Durante las pruebas cualquier factura debe poder borrarse (soft-delete,
  // reversible desde la base de datos vía `deleted_at`).
  const canDelete = true;

  return (
    <div className="flex items-center gap-2">
      <FormFeedback state={feedback.state} />

      <Button variant="outline" size="sm" asChild>
        <a href={`/api/invoices/${invoice.id}/pdf`}>
          <Download className="mr-2 h-4 w-4" />
          Descargar PDF
        </a>
      </Button>

      {canEdit && (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/invoices/${invoice.id}/edit`}>
            <FileEdit className="mr-2 h-4 w-4" />
            Editar
          </Link>
        </Button>
      )}

      {canIssue && (
        <Button size="sm" disabled={pending} onClick={() => handleStatusUpdate("issued")}>
          {pendingStatus === "issued"
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <Send className="mr-2 h-4 w-4" />}
          {pendingStatus === "issued" ? "Emitiendo…" : "Emitir factura"}
        </Button>
      )}

      {canMarkPaid && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => handleStatusUpdate("paid")}
          className="text-success-foreground hover:text-success-foreground"
        >
          {pendingStatus === "paid"
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <CheckCircle2 className="mr-2 h-4 w-4" />}
          {pendingStatus === "paid" ? "Guardando…" : "Marcar pagada"}
        </Button>
      )}

      {canMarkUncollected && (
        <>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setConfirmUncollected(true)}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Marcar como no cobrada
          </Button>
          <Dialog open={confirmUncollected} onOpenChange={setConfirmUncollected}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>¿Revertir cobro de la factura?</DialogTitle>
                <DialogDescription>
                  Esto eliminará la fecha de cobro y devolverá la factura al estado{" "}
                  <strong>Emitida</strong>. Esta acción debería usarse solo para corregir errores,
                  nunca para anular un cobro real.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => setConfirmUncollected(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    setConfirmUncollected(false);
                    handleStatusUpdate("issued", "Factura marcada como no cobrada");
                  }}
                >
                  Confirmar reversión
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* AEAT Button if already issued */}
      {!isDraft &&
        invoice.verifactu_status !== "accepted" &&
        invoice.verifactu_status !== "excluded" ? (
        <SendAeatButton
          invoiceId={invoice.id}
          label={invoice.verifactu_status === "rejected" ? "Reintentar AEAT" : "Enviar a AEAT"}
        />
      ) : null}

      {(canCancel || canDelete) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canCancel && (
              <DropdownMenuItem
                className="text-destructive"
                disabled={pending}
                onClick={() => handleStatusUpdate("cancelled")}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Anular factura
              </DropdownMenuItem>
            )}
            {canDelete && (
              <>
                {canCancel && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  className="text-destructive"
                  disabled={pending || deletePending}
                  onClick={handleDelete}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
