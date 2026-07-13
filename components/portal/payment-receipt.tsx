import { LogoMark } from "@/components/branding";
import { ReceiptPrintButton } from "@/components/portal/receipt-print-button";
import { formatDate, formatEUR } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

interface PaymentReceiptProps {
  /** Redsys order reference shown under the title. */
  orderRef: string | null;
  /** Issuer company data from settings. */
  company: {
    name?: string | null;
    nif?: string | null;
    address?: string | null;
  };
  /** Who paid (client/lead) and their fiscal id. */
  recipientName: string;
  recipientNif?: string | null;
  /** "En concepto de" block: main line and supporting detail. */
  conceptTitle: string;
  conceptSubtitle: string;
  /** Confirmed payment data. */
  confirmedAt: string | null;
  authorisationCode?: string | null;
  amount: number;
  /** Closing legal note tailored to invoice vs proposal. */
  footerNote: string;
}

/**
 * Shared layout for the public payment receipt ("Justificante de Pago").
 * Used by both invoice and proposal portals; only the surrounding data
 * fetching and a few labels differ between them.
 */
export function PaymentReceipt({
  orderRef,
  company,
  recipientName,
  recipientNif,
  conceptTitle,
  conceptSubtitle,
  confirmedAt,
  authorisationCode,
  amount,
  footerNote,
}: PaymentReceiptProps) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 sm:p-8 print:p-0 print:bg-white">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        {/* Header with Print button (hidden on print) */}
        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">Pago confirmado</span>
          </div>
          <ReceiptPrintButton />
        </div>

        {/* The Receipt Document */}
        <article className="bg-white dark:bg-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-800 p-8 sm:p-12 print:shadow-none print:border-none">
          <div className="flex justify-between items-start mb-12">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <LogoMark size={24} className="text-[#2A4227] dark:text-[#9CC196]" />
                <span className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                  doscientos
                </span>
              </div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-4">
                Justificante de Pago
              </h1>
              <p className="text-sm text-zinc-500">Ref: {orderRef}</p>
            </div>
            {company.name && (
              <div className="text-right flex flex-col gap-1">
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{company.name}</p>
                <p className="text-xs text-zinc-500">{company.nif}</p>
                <p className="text-xs text-zinc-500 whitespace-pre-line max-w-50">
                  {company.address}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-12 mb-12 border-y border-zinc-100 dark:border-zinc-800 py-8">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
                  Pagado por
                </p>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {recipientName}
                </p>
                {recipientNif && <p className="text-xs text-zinc-500">NIF: {recipientNif}</p>}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
                  En concepto de
                </p>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {conceptTitle}
                </p>
                <p className="text-xs text-zinc-500">{conceptSubtitle}</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
                  Detalles del pago
                </p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Fecha:</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {formatDate(confirmedAt as string)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Método:</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      Tarjeta / Bizum (Redsys)
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Autorización:</span>
                    <span className="font-mono text-xs text-zinc-900 dark:text-zinc-100">
                      {authorisationCode ?? "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end items-center py-6">
            <div className="flex flex-col items-end gap-1">
              <p className="text-xs text-zinc-500 font-medium">Importe abonado</p>
              <p className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">
                {formatEUR(amount)}
              </p>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-zinc-100 dark:border-zinc-800 text-center">
            <p className="text-[10px] text-zinc-400 max-w-md mx-auto leading-relaxed">
              {footerNote}
            </p>
          </div>
        </article>
      </div>
    </div>
  );
}
