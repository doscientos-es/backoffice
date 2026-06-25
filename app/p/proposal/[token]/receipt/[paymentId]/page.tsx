import { LogoMark } from "@/components/branding";
import { ReceiptPrintButton } from "@/components/portal/receipt-print-button";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatEUR } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProposalReceiptPage({
  params,
}: {
  params: Promise<{ token: string; paymentId: string }>;
}) {
  const { token, paymentId } = await params;
  const admin = createAdminClient();

  // Load proposal to verify token and get context
  const { data: proposal } = await admin
    .from("proposals")
    .select("*, clients(name, nif, billing_address), leads(name, company)")
    .eq("portal_token", token)
    .maybeSingle();

  if (!proposal) notFound();

  // Load specific payment
  const { data: payment } = await admin
    .from("invoice_payments")
    .select("*")
    .eq("id", paymentId)
    .eq("proposal_id", proposal.id as string)
    .eq("status", "confirmed")
    .maybeSingle();

  if (!payment) notFound();

  const { data: settings } = await admin.from("settings").select("*").eq("id", 1).maybeSingle();

  const client = (proposal as any).clients;
  const lead = (proposal as any).leads;
  const recipientName = client?.name ?? lead?.company ?? lead?.name ?? "—";
  const recipientNif = client?.nif ?? (proposal.accepted_fiscal_data as any)?.nif ?? "";

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
              <p className="text-sm text-zinc-500">Ref: {payment.redsys_order}</p>
            </div>
            {settings?.company_name && (
              <div className="text-right flex flex-col gap-1">
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {settings.company_name as string}
                </p>
                <p className="text-xs text-zinc-500">{settings.company_nif as string}</p>
                <p className="text-xs text-zinc-500 whitespace-pre-line max-w-50">
                  {settings.company_address as string}
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
                {recipientNif && (
                  <p className="text-xs text-zinc-500">NIF: {recipientNif}</p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
                  En concepto de
                </p>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Reserva de proyecto: {proposal.title as string}
                </p>
                <p className="text-xs text-zinc-500">
                  Presupuesto {proposal.number as string}
                </p>
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
                      {formatDate(payment.confirmed_at as string)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Método:</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">Tarjeta / Bizum (Redsys)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Autorización:</span>
                    <span className="font-mono text-xs text-zinc-900 dark:text-zinc-100">
                      {payment.ds_authorisation_code ?? "—"}
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
                {formatEUR(Number(payment.amount))}
              </p>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-zinc-100 dark:border-zinc-800 text-center">
            <p className="text-[10px] text-zinc-400 max-w-md mx-auto leading-relaxed">
              Este documento es un justificante de la transacción realizada a través de nuestra pasarela de pagos.
              Conserve este comprobante junto con su presupuesto aceptado.
            </p>
          </div>
        </article>
      </div>
    </div>
  );
}
