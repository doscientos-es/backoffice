"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import {
  CheckCircle2,
  Download,
  FileEdit,
  MoreHorizontal,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteInvoice, updateInvoiceStatus } from "../actions";
import { SendAeatButton } from "./send-aeat-button";

interface Props {
  invoice: {
    id: string;
    status: string;
    verifactu_status: string;
  };
}

export function InvoiceActions({ invoice }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const feedback = useFormFeedback();

  const handleStatusUpdate = (status: "issued" | "paid" | "cancelled", successLabel?: string) => {
    startTransition(async () => {
      feedback.setPending();
      const res = await updateInvoiceStatus({ id: invoice.id, status });
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

  const handleDelete = async () => {
    if (!confirm("¿Estás seguro de que quieres eliminar esta factura?")) return;

    startTransition(async () => {
      const fd = new FormData();
      fd.append("id", invoice.id);
      const res = await deleteInvoice(fd);
      if (res.ok) {
        router.push("/invoices");
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
          <Send className="mr-2 h-4 w-4" />
          Emitir factura
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
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Marcar pagada
        </Button>
      )}

      {canMarkUncollected && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => handleStatusUpdate("issued", "Factura marcada como no cobrada")}
        >
          <XCircle className="mr-2 h-4 w-4" />
          Marcar como no cobrada
        </Button>
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
                  disabled={pending}
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
