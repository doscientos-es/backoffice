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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { useUndoableDelete } from "@/lib/hooks/use-undoable-delete";
import { PAYMENT_METHOD_LABELS, type PaymentMethodType } from "@/lib/schemas/invoice";
import { userVerificationScope } from "@/lib/security/user-verification-scope";
import { verifyWithPasskey } from "@/lib/security/webauthn-client";
import { INVOICE_STATUS, VERIFACTU_STATUS } from "@/lib/status";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileEdit,
  FileMinus2,
  Loader2,
  MoreHorizontal,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createRectification,
  deleteInvoice,
  markAsUncollectible,
  restoreInvoice,
  updateInvoiceStatus,
} from "../actions";
import {
  InvoiceIssuanceProgressDialog,
  type InvoiceIssuancePhase,
} from "./invoice-issuance-progress-dialog";
import { SendAeatButton } from "./send-aeat-button";
import { SendInvoiceButton } from "./send-invoice-button";

/** Builds the `{ id }` FormData both delete and restore invoice actions expect. */
function idFormData(invoiceId: string): FormData {
  const fd = new FormData();
  fd.append("id", invoiceId);
  return fd;
}

const RECTIFICATION_TYPES = [
  {
    value: "R1",
    label: "R1 – Error en datos o devolución",
    description: "Importe incorrecto, datos erróneos del cliente, devolución parcial o total.",
  },
  {
    value: "R4",
    label: "R4 – Otras causas",
    description: "Cualquier otra corrección no contemplada en R1.",
  },
] as const;

interface Props {
  invoice: {
    id: string;
    status: string;
    verifactu_status: string;
    /** Whether this invoice is itself a rectification (can't be rectified again). */
    is_rectification?: boolean;
    /** Whether this invoice has already been marked as uncollectible. */
    is_uncollectible?: boolean;
  };
  /** Client email, prefilled as the default recipient in the send dialog. */
  clientEmail?: string | null;
}

function issuancePhaseForDelivery(status: string | null): InvoiceIssuancePhase {
  if (status === "accepted") return "accepted";
  if (status === "rejected") return "rejected";
  if (status === "error") return "delivery_error";
  return "deferred";
}

export function InvoiceActions({ invoice, clientEmail }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const feedback = useFormFeedback();
  const [confirmUncollected, setConfirmUncollected] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodType>("transfer");
  const [showUncollectibleDialog, setShowUncollectibleDialog] = useState(false);
  const [showRectification, setShowRectification] = useState(false);
  const [rectType, setRectType] = useState<"R1" | "R4">("R1");
  const [rectReason, setRectReason] = useState("");
  const [issuanceOpen, setIssuanceOpen] = useState(false);
  const [issuanceProgress, setIssuanceProgress] = useState<{
    phase: InvoiceIssuancePhase;
    error: string | null;
    csv: string | null;
  }>({ phase: "verifying", error: null, csv: null });

  // Soft-delete (reversible via `deleted_at`): frictionless delete with a
  // "Deshacer" toast instead of a blocking confirm dialog.
  const { run: handleDelete, pending: deletePending } = useUndoableDelete({
    successMessage: "Factura eliminada",
    onDelete: () => deleteInvoice(idFormData(invoice.id)),
    onRestore: () => restoreInvoice(idFormData(invoice.id)),
    redirectTo: "/invoices",
  });

  const handleStatusUpdate = async (
    status: "issued" | "paid" | "cancelled",
    opts?: { paymentMethod?: PaymentMethodType; successLabel?: string },
  ) => {
    feedback.setPending();
    const verification = await verifyWithPasskey(
      userVerificationScope("invoice.status.update", `invoice:${invoice.id}:status:${status}`),
    );
    if (!verification.ok) {
      feedback.setError(verification.error);
      return;
    }
    setPendingStatus(status);
    startTransition(async () => {
      const res = await updateInvoiceStatus({
        id: invoice.id,
        status,
        ...(opts?.paymentMethod ? { paymentMethod: opts.paymentMethod } : {}),
      });
      setPendingStatus(null);
      if (res.ok) {
        feedback.setSuccess(opts?.successLabel ?? "Factura pagada");
      } else {
        feedback.setError(res.error);
      }
    });
  };

  async function handleIssue() {
    feedback.setPending();
    setIssuanceProgress({ phase: "verifying", error: null, csv: null });
    setIssuanceOpen(true);
    const verification = await verifyWithPasskey(
      userVerificationScope("invoice.status.update", `invoice:${invoice.id}:status:issued`),
    );
    if (!verification.ok) {
      feedback.setError(verification.error);
      setIssuanceProgress({ phase: "error", error: verification.error, csv: null });
      return;
    }
    setPendingStatus("issued");
    setIssuanceProgress({ phase: "processing", error: null, csv: null });
    startTransition(async () => {
      const res = await updateInvoiceStatus({ id: invoice.id, status: "issued" });
      setPendingStatus(null);
      if (!res.ok) {
        feedback.setError(res.error);
        setIssuanceProgress({ phase: "error", error: res.error, csv: null });
        return;
      }
      const phase = issuancePhaseForDelivery(res.fiscalDeliveryStatus);
      setIssuanceProgress({ phase, error: null, csv: res.fiscalDeliveryCsv });
      if (phase === "accepted") {
        feedback.setSuccess("Factura emitida y aceptada por AEAT");
      } else if (phase === "rejected") {
        feedback.setError("La factura se emitió, pero AEAT rechazó el registro fiscal.");
      } else if (phase === "delivery_error") {
        feedback.setError("La factura se emitió; la entrega fiscal requiere atención.");
      } else {
        feedback.setSuccess("Factura emitida. La entrega fiscal sigue en la cola durable.");
      }
      router.refresh();
    });
  }

  const handleMarkUncollectible = () => {
    startTransition(async () => {
      feedback.setPending();
      const res = await markAsUncollectible({ id: invoice.id });
      setShowUncollectibleDialog(false);
      if (res.ok) {
        feedback.setSuccess("Factura marcada como incobrable");
      } else {
        feedback.setError(res.error);
      }
    });
  };

  const handleCreateRectification = () => {
    if (!rectReason.trim()) return;
    startTransition(async () => {
      feedback.setPending();
      const res = await createRectification({
        originalInvoiceId: invoice.id,
        rectificationType: rectType,
        reason: rectReason.trim(),
      });
      if (res.ok) {
        setShowRectification(false);
        setRectReason("");
        router.push(`/invoices/${res.id}`);
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
  // Once issued (or beyond), the invoice has a portal link worth emailing.
  const canSendEmail = !isDraft;
  const canMarkPaid = isIssued || isOverdue;
  const canMarkUncollected = isPaid;
  // Marcar incobrable: solo facturas emitidas/vencidas no pagadas (art. 80.Tres LIVA)
  const canMarkUncollectible = (isIssued || isOverdue) && !invoice.is_uncollectible;
  const canCancel = isIssued || isOverdue;
  // Las facturas aceptadas por la AEAT son inmutables por ley (RD 1007/2023).
  // Nunca pueden eliminarse; debe emitirse una factura rectificativa en su lugar.
  const canDelete = invoice.verifactu_status !== "accepted";
  // Rectification: only for issued/paid/overdue invoices that are not themselves rectifications.
  const canRectify = (isIssued || isPaid || isOverdue) && !invoice.is_rectification;

  return (
    <div className="grid w-full min-w-0 grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap sm:gap-2">
      {/* Status badges — lives here so the page header actions slot stays compact */}
      <div className="col-span-2 flex shrink-0 flex-wrap items-center gap-2 sm:mr-1 sm:flex-col sm:items-end sm:gap-1">
        <StatusBadge meta={INVOICE_STATUS} value={invoice.status} />
        <StatusBadge
          meta={VERIFACTU_STATUS}
          value={invoice.verifactu_status}
          className="text-[10px] py-0 h-4"
          labelPrefix="Verifactu: "
        />
      </div>

      {/* Subtle vertical separator */}
      <div className="hidden h-7 w-px shrink-0 bg-border sm:block sm:mx-0.5" aria-hidden />

      {feedback.state.status !== "idle" ? (
        <div className="col-span-2 min-w-0 max-w-full sm:flex-1">
          <FormFeedback state={feedback.state} className="max-w-full min-w-0" />
        </div>
      ) : null}

      {/* Icon-only secondary actions */}
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2 sm:w-auto sm:justify-center sm:gap-0 sm:px-2"
        title="Descargar PDF"
        aria-label="Descargar PDF"
        asChild
      >
        <a href={`/api/invoices/${invoice.id}/pdf`}>
          <Download className="h-4 w-4" />
          <span className="sm:hidden">Descargar PDF</span>
        </a>
      </Button>

      {canEdit && (
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 sm:w-auto sm:justify-center sm:gap-0 sm:px-2"
          title="Editar factura"
          aria-label="Editar factura"
          asChild
        >
          <Link href={`/invoices/${invoice.id}/edit`}>
            <FileEdit className="h-4 w-4" />
            <span className="sm:hidden">Editar</span>
          </Link>
        </Button>
      )}

      {canSendEmail && (
        <SendInvoiceButton invoiceId={invoice.id} defaultEmail={clientEmail} iconOnly />
      )}

      {/* Primary CTA — keep text for clarity */}
      {canIssue && (
        <Button
          className="col-span-2 w-full justify-center whitespace-nowrap sm:w-auto"
          size="sm"
          disabled={pending || issuanceOpen}
          onClick={handleIssue}
        >
          {pendingStatus === "issued" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {pendingStatus === "issued" ? "Emitiendo…" : "Emitir"}
        </Button>
      )}

      {canMarkPaid && (
        <>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setShowPaymentDialog(true)}
            className="w-full justify-center whitespace-nowrap text-success-foreground hover:text-success-foreground sm:w-auto"
          >
            {pendingStatus === "paid" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {pendingStatus === "paid" ? "Guardando…" : "Pagada"}
          </Button>
          <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Registrar cobro</DialogTitle>
                <DialogDescription>
                  Selecciona el medio de pago utilizado para cobrar esta factura.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Label>Medio de cobro</Label>
                <div className="space-y-1.5">
                  {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethodType[]).map((method) => (
                    <label
                      key={method}
                      className="flex items-center gap-3 rounded-md border p-3 cursor-pointer has-checked:border-primary"
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method}
                        checked={selectedPaymentMethod === method}
                        onChange={() => setSelectedPaymentMethod(method)}
                        className="mt-0"
                      />
                      <span className="text-sm font-medium">{PAYMENT_METHOD_LABELS[method]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => setShowPaymentDialog(false)}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    setShowPaymentDialog(false);
                    handleStatusUpdate("paid", { paymentMethod: selectedPaymentMethod });
                  }}
                >
                  Confirmar cobro
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {canMarkUncollected && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="col-span-2 w-full justify-start gap-2 sm:w-auto sm:justify-center sm:gap-0 sm:px-2"
            disabled={pending}
            title="Revertir cobro"
            aria-label="Revertir cobro"
            onClick={() => setConfirmUncollected(true)}
          >
            <XCircle className="h-4 w-4" />
            <span className="sm:hidden">Revertir cobro</span>
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
                    handleStatusUpdate("issued", {
                      successLabel: "Factura marcada como no cobrada",
                    });
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
          label={
            invoice.verifactu_status === "rejected"
              ? "Reintentar AEAT"
              : invoice.verifactu_status === "error"
                ? "Reintentar envío"
                : "Enviar a AEAT"
          }
        />
      ) : null}

      {(canCancel || canDelete || canRectify || canMarkUncollectible) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="col-span-2 w-full justify-center gap-2 sm:w-auto sm:justify-self-auto sm:gap-0 sm:border-0"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sm:hidden">Más acciones</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canRectify && (
              <DropdownMenuItem onClick={() => setShowRectification(true)}>
                <FileMinus2 className="mr-2 h-4 w-4" />
                Emitir factura rectificativa
              </DropdownMenuItem>
            )}
            {canMarkUncollectible && (
              <DropdownMenuItem
                className="text-warning"
                onClick={() => setShowUncollectibleDialog(true)}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Marcar como incobrable
              </DropdownMenuItem>
            )}
            {(canRectify || canMarkUncollectible) && (canCancel || canDelete) && (
              <DropdownMenuSeparator />
            )}
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

      {/* Rectification modal */}
      <Dialog open={showRectification} onOpenChange={setShowRectification}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Factura rectificativa</DialogTitle>
            <DialogDescription>
              Se creará un borrador en serie R con los mismos importes y líneas. Podrás editarlo
              antes de enviarlo a la AEAT. La factura original quedará marcada como rectificada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tipo de rectificación</Label>
              <div className="space-y-2">
                {RECTIFICATION_TYPES.map((t) => (
                  <label
                    key={t.value}
                    className="flex items-start gap-3 rounded-md border p-3 cursor-pointer has-checked:border-primary"
                  >
                    <input
                      type="radio"
                      name="rectType"
                      value={t.value}
                      checked={rectType === t.value}
                      onChange={() => setRectType(t.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-medium text-sm">{t.label}</div>
                      <div className="text-xs text-muted-foreground">{t.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rectReason">
                Motivo de la rectificación <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="rectReason"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-20 resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Describe el motivo de la rectificación (requerido por ley)"
                value={rectReason}
                onChange={(e) => setRectReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setShowRectification(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={pending || !rectReason.trim()}
              onClick={handleCreateRectification}
            >
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Crear borrador rectificativa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Incobrable confirmation dialog */}
      <Dialog open={showUncollectibleDialog} onOpenChange={setShowUncollectibleDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Marcar como incobrable</DialogTitle>
            <DialogDescription>
              Esta acción declara el crédito como incobrable según el art. 80.Tres LIVA. Podrás
              recuperar el IVA emitiendo una <strong>factura rectificativa R4</strong>. ¿Confirmar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setShowUncollectibleDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={handleMarkUncollectible}
            >
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar incobrable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InvoiceIssuanceProgressDialog
        open={issuanceOpen}
        phase={issuanceProgress.phase}
        error={issuanceProgress.error}
        csv={issuanceProgress.csv}
        onClose={() => setIssuanceOpen(false)}
      />
    </div>
  );
}
