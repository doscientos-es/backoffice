"use client";

import { CreditCard, Landmark } from "lucide-react";

import { CopyButton } from "@/components/ui/copy-button";
import { formatPortalEUR } from "@/lib/portal/language";

import { ProposalPaymentButton } from "./proposal-payment-button";

interface ProposalPaymentOptionsProps {
  proposalId: string;
  token: string;
  proposalNumber: string;
  initialPaymentPercentage: number;
  depositAmount: number;
  companyName: string | null;
  iban: string | null;
  language?: "es" | "ca" | "en";
}

/** Offers the agreed first payment through the gateway or a bank transfer. */
export function ProposalPaymentOptions({
  proposalId,
  token,
  proposalNumber,
  initialPaymentPercentage,
  depositAmount,
  companyName,
  iban,
  language = "es",
}: ProposalPaymentOptionsProps) {
  const copy =
    language === "ca"
      ? {
          first: "Fes el primer pagament",
          intro: "Per posar en marxa el projecte, abona el primer termini acordat (",
          card: "Targeta o Bizum",
          safe: "Pagament segur a través de la nostra passarel·la integrada.",
          pay: "Pagar el primer termini",
          bank: "Transferència bancària",
          bankInfo: "També pots pagar aquest termini abans de rebre la factura.",
          beneficiary: "Beneficiari",
          concept: "Concepte",
          amount: "Import",
          copyIban: "Copiar IBAN",
          copyBeneficiary: "Copiar beneficiari",
          copyConcept: "Copiar concepte",
          copyAll: "Copiar totes les dades de la transferència",
          copied: "Dades de la transferència copiades",
        }
      : language === "en"
        ? {
            first: "Make the first payment",
            intro: "To get the project started, pay the agreed first instalment (",
            card: "Card or Bizum",
            safe: "Secure payment through our integrated payment gateway.",
            pay: "Pay first instalment",
            bank: "Bank transfer",
            bankInfo: "You can also pay this instalment before receiving the invoice.",
            beneficiary: "Beneficiary",
            concept: "Reference",
            amount: "Amount",
            copyIban: "Copy IBAN",
            copyBeneficiary: "Copy beneficiary",
            copyConcept: "Copy reference",
            copyAll: "Copy all bank transfer details",
            copied: "Bank transfer details copied",
          }
        : {
            first: "Realiza el primer pago",
            intro: "Para poner en marcha el proyecto, abona el primer plazo acordado (",
            card: "Tarjeta o Bizum",
            safe: "Pago seguro mediante nuestra pasarela integrada.",
            pay: "Pagar primer plazo",
            bank: "Transferencia bancaria",
            bankInfo: "También puede pagar este plazo antes de recibir la factura.",
            beneficiary: "Beneficiario",
            concept: "Concepto",
            amount: "Importe",
            copyIban: "Copiar IBAN",
            copyBeneficiary: "Copiar beneficiario",
            copyConcept: "Copiar concepto",
            copyAll: "Copiar todos los datos de la transferencia",
            copied: "Datos de la transferencia copiados",
          };
  const money = (amount: number) => formatPortalEUR(amount, language);
  const transferConcept = `Propuesta ${proposalNumber}`;
  const transferCopyText = [
    `Beneficiario: ${companyName ?? "—"}`,
    `IBAN: ${iban ?? "—"}`,
    `Concepto: ${transferConcept}`,
    `${copy.amount} del primer plazo: ${money(depositAmount)}`,
  ].join("\n");

  return (
    <section aria-labelledby="proposal-payment-options-title" className="w-full max-w-2xl">
      <div className="mb-4 space-y-1 text-center">
        <h2
          id="proposal-payment-options-title"
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
        >
          {copy.first}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {copy.intro}
          {initialPaymentPercentage} %) de{" "}
          <strong className="text-zinc-900 tabular-nums dark:text-zinc-100">
            {money(depositAmount)}
          </strong>
          .
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-zinc-900 p-5 text-left shadow-sm ring-1 ring-zinc-800 dark:bg-zinc-800">
          <div className="mb-4 flex items-start gap-3">
            <CreditCard className="mt-0.5 size-5 shrink-0 text-white" aria-hidden />
            <div>
              <h3 className="font-semibold text-white">{copy.card}</h3>
              <p className="mt-1 text-sm text-zinc-400">{copy.safe}</p>
            </div>
          </div>
          <ProposalPaymentButton
            proposalId={proposalId}
            token={token}
            depositAmount={depositAmount}
            paymentLabel={copy.pay}
          />
        </div>

        {iban ? (
          <div className="rounded-xl bg-white p-5 text-left shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
            <div className="mb-4 flex items-start gap-3">
              <Landmark
                className="mt-0.5 size-5 shrink-0 text-zinc-700 dark:text-zinc-300"
                aria-hidden
              />
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{copy.bank}</h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{copy.bankInfo}</p>
              </div>
            </div>

            <dl className="grid gap-3 text-sm">
              <TransferDetail label="IBAN" value={iban} copyLabel={copy.copyIban} />
              <TransferDetail
                label={copy.beneficiary}
                value={companyName ?? "—"}
                copyLabel={copy.copyBeneficiary}
              />
              <TransferDetail
                label={copy.concept}
                value={transferConcept}
                copyLabel={copy.copyConcept}
              />
              <TransferDetail label={copy.amount} value={money(depositAmount)} />
            </dl>

            <CopyButton
              text={transferCopyText}
              label={copy.copyAll}
              successMessage={copy.copied}
              showLabel
              className="mt-5 border border-zinc-200 dark:border-zinc-700"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function TransferDetail({
  label,
  value,
  copyLabel,
}: {
  label: string;
  value: string;
  copyLabel?: string;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <dt className="shrink-0 text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5 text-right font-medium text-zinc-900 dark:text-zinc-100">
        <span className={label === "IBAN" ? "truncate font-mono" : "truncate"}>{value}</span>
        {copyLabel ? <CopyButton text={value} label={copyLabel} /> : null}
      </dd>
    </div>
  );
}
