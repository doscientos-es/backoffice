'use client'

import { CreditCard, Landmark } from 'lucide-react'

import { CopyButton } from '@/components/ui/copy-button'
import { formatPortalEUR } from '@/lib/portal/language'

import { RedsysPaymentButton } from './redsys-payment-button'

interface InvoicePaymentOptionsProps {
  invoiceId: string
  token: string
  total: number
  amountPaid: number
  invoiceNumber: string
  companyName: string | null
  iban: string | null
  language?: 'es' | 'ca' | 'en'
}

/** Shows the online gateway and bank-transfer alternatives for an unpaid invoice. */
export function InvoicePaymentOptions({
  invoiceId,
  token,
  total,
  amountPaid,
  invoiceNumber,
  companyName,
  iban,
  language = 'es',
}: InvoicePaymentOptionsProps) {
  const copy = language === 'ca'
    ? { pay: 'Tria com pagar', due: 'Import pendent:', card: 'Targeta o Bizum', safe: 'Paga de manera segura a través de la nostra passarel·la de pagament integrada.', bank: 'Transferència bancària', bankInfo: 'També pots fer una transferència amb aquestes dades.', beneficiary: 'Beneficiari', concept: 'Concepte', amount: 'Import', copyIban: 'Copiar IBAN', copyBeneficiary: 'Copiar beneficiari', copyConcept: 'Copiar concepte', copyAll: 'Copiar totes les dades de la transferència', copied: 'Dades de la transferència copiades' }
    : language === 'en'
      ? { pay: 'Choose how to pay', due: 'Amount due:', card: 'Card or Bizum', safe: 'Pay securely through our integrated payment gateway.', bank: 'Bank transfer', bankInfo: 'You can also make a bank transfer using these details.', beneficiary: 'Beneficiary', concept: 'Reference', amount: 'Amount', copyIban: 'Copy IBAN', copyBeneficiary: 'Copy beneficiary', copyConcept: 'Copy reference', copyAll: 'Copy all bank transfer details', copied: 'Bank transfer details copied' }
      : { pay: 'Elige cómo pagar', due: 'Importe pendiente:', card: 'Tarjeta o Bizum', safe: 'Paga de forma segura mediante nuestra pasarela de pago integrada.', bank: 'Transferencia bancaria', bankInfo: 'También puede realizar una transferencia normal con estos datos.', beneficiary: 'Beneficiario', concept: 'Concepto', amount: 'Importe', copyIban: 'Copiar IBAN', copyBeneficiary: 'Copiar beneficiario', copyConcept: 'Copiar concepto', copyAll: 'Copiar todos los datos de la transferencia', copied: 'Datos de la transferencia copiados' }
  const money = (amount: number) => formatPortalEUR(amount, language)
  const amountDue = Math.round((total - amountPaid) * 100) / 100
  const transferConcept = `Factura ${invoiceNumber}`
  const transferCopyText = [
    `Beneficiario: ${companyName ?? '—'}`,
    `IBAN: ${iban ?? '—'}`,
    `Concepto: ${transferConcept}`,
    `${copy.amount}: ${money(amountDue)}`,
  ].join('\n')

  return (
    <section aria-labelledby="payment-options-title" className="flex flex-col gap-3">
      <div>
        <h2 id="payment-options-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          {copy.pay}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {copy.due} <strong className="text-zinc-900 tabular-nums dark:text-zinc-100">{money(amountDue)}</strong>
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-zinc-900 p-6 shadow-sm ring-1 ring-zinc-800 dark:bg-zinc-800">
          <div className="mb-5 flex items-start gap-3">
            <CreditCard className="mt-0.5 size-5 shrink-0 text-white" aria-hidden />
            <div>
              <h3 className="font-bold text-white">{copy.card}</h3>
              <p className="mt-1 text-sm text-zinc-400">
                {copy.safe}
              </p>
            </div>
          </div>
          <RedsysPaymentButton
            invoiceId={invoiceId}
            token={token}
            total={total}
            amountPaid={amountPaid}
            language={language}
          />
        </div>

        {iban ? (
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
            <div className="mb-5 flex items-start gap-3">
              <Landmark className="mt-0.5 size-5 shrink-0 text-zinc-700 dark:text-zinc-300" aria-hidden />
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{copy.bank}</h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {copy.bankInfo}
                </p>
              </div>
            </div>

            <dl className="grid gap-3 text-sm">
              <TransferDetail label="IBAN" value={iban} copyLabel={copy.copyIban} />
              <TransferDetail
                label={copy.beneficiary}
                value={companyName ?? '—'}
                copyLabel={copy.copyBeneficiary}
              />
              <TransferDetail label={copy.concept} value={transferConcept} copyLabel={copy.copyConcept} />
              <TransferDetail label={copy.amount} value={money(amountDue)} />
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
  )
}

function TransferDetail({
  label,
  value,
  copyLabel,
}: {
  label: string
  value: string
  copyLabel?: string
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <dt className="shrink-0 text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5 text-right font-medium text-zinc-900 dark:text-zinc-100">
        <span className={label === 'IBAN' ? 'truncate font-mono' : 'truncate'}>{value}</span>
        {copyLabel ? <CopyButton text={value} label={copyLabel} /> : null}
      </dd>
    </div>
  )
}
