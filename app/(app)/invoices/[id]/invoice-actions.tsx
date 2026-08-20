"use client";

import { Download, FileEdit } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { IconButton } from "@/components/ui/icon-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { INVOICE_STATUS, VERIFACTU_STATUS } from "@/lib/status";
import type { InvoiceActionInvoice } from "./invoice-action-contracts";
import { aeatDeliveryLabel, getInvoiceActionPolicy } from "./invoice-action-policy";
import { InvoiceIssuanceAction } from "./invoice-issuance-action";
import { InvoiceMoreActions } from "./invoice-more-actions";
import { InvoicePaymentActions } from "./invoice-payment-actions";
import { RegularizeAeatButton } from "./regularize-aeat-button";
import { SendAeatButton } from "./send-aeat-button";
import { SendInvoiceButton } from "./send-invoice-button";
import { useInvoiceStatusVerification } from "./use-invoice-status-verification";
import { VerifactuIssueDetailsButton } from "./verifactu-issue-dialog";

interface Props {
  invoice: InvoiceActionInvoice;
  clientEmail?: string | null;
}

/**
 * Composition root for invoice actions. Policy, security checks and individual
 * financial workflows live in focused modules so this component only declares
 * the visible action surface.
 */
export function InvoiceActions({ invoice, clientEmail }: Props) {
  const router = useRouter();
  const feedback = useFormFeedback();
  const policy = getInvoiceActionPolicy(invoice);
  const { challenge, verifyStatusChange } = useInvoiceStatusVerification(invoice.id, feedback);

  return (
    <div className="flex w-full min-w-0 flex-col gap-2 sm:w-[min(100%,34rem)] sm:items-end">
      {challenge}
      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
        <StatusBadge meta={INVOICE_STATUS} value={invoice.status} />
        <StatusBadge
          meta={VERIFACTU_STATUS}
          value={invoice.verifactu_status}
          className="h-4 py-0 text-[10px]"
          labelPrefix="Verifactu: "
        />
        {policy.hasFiscalProblem ? (
          <VerifactuIssueDetailsButton
            status={invoice.verifactu_status as "error" | "rejected"}
            error={invoice.verifactu_error}
          />
        ) : null}
      </div>

      {feedback.state.status !== "idle" ? (
        <div className="min-w-0 max-w-full">
          <FormFeedback state={feedback.state} className="min-w-0 max-w-full" />
        </div>
      ) : null}

      <div className="flex w-full items-center justify-end gap-2">
        <IconButton variant="outline" label="Descargar PDF" className="shrink-0" asChild>
          <a href={`/api/invoices/${invoice.id}/pdf`}>
            <Download className="h-4 w-4" />
          </a>
        </IconButton>
        {policy.canEdit ? (
          <IconButton variant="outline" label="Editar factura" className="shrink-0" asChild>
            <Link href={`/invoices/${invoice.id}/edit`}>
              <FileEdit className="h-4 w-4" />
            </Link>
          </IconButton>
        ) : null}
        {policy.canSendEmail ? (
          <SendInvoiceButton invoiceId={invoice.id} defaultEmail={clientEmail} iconOnly />
        ) : null}
      </div>

      <div className="flex w-full flex-wrap justify-end gap-2">
        {policy.canIssue ? (
          <InvoiceIssuanceAction
            invoiceId={invoice.id}
            feedback={feedback}
            verifyStatusChange={verifyStatusChange}
            onIssued={() => router.refresh()}
          />
        ) : null}
        <InvoicePaymentActions
          invoiceId={invoice.id}
          total={invoice.total}
          amountPaid={invoice.amountPaid}
          canRecordPayment={policy.canRecordPayment}
          canRevertPayment={policy.canRevertPayment}
          feedback={feedback}
          verifyStatusChange={verifyStatusChange}
          onChanged={() => router.refresh()}
        />
        {policy.shouldSendToAeat ? (
          <SendAeatButton
            invoiceId={invoice.id}
            label={aeatDeliveryLabel(invoice.verifactu_status)}
          />
        ) : null}
        {policy.hasFiscalProblem ? <RegularizeAeatButton invoiceId={invoice.id} /> : null}
        <InvoiceMoreActions
          invoiceId={invoice.id}
          canCancel={policy.canCancel}
          canDelete={policy.canDelete}
          canRectify={policy.canRectify}
          canMarkUncollectible={policy.canMarkUncollectible}
          feedback={feedback}
          verifyStatusChange={verifyStatusChange}
        />
      </div>
    </div>
  );
}
