'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { PaymentPlanEditor } from '@/components/proposals/payment-plan-editor'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import type { PaymentPlanItem } from '@/lib/proposals/scope'
import { formatEUR as formatCurrency } from '@/lib/utils'

import { createInvoiceFromProposalPlanItem } from '../../invoices/actions'
import { updateProposalPaymentPlan } from '../actions'

type InvoiceRef = {
  id: string
  planItemId: string
  number: string
  status: string
  total: number
  paid: number
}
type ExternalPaymentRef = { planItemId: string; amount: number }

type Props = {
  proposalId: string
  initialPlan: PaymentPlanItem[]
  initialVersion: number
  total: number
  canEdit: boolean
  invoices: InvoiceRef[]
  externalPayments: ExternalPaymentRef[]
}

/** Keeps future collection dates editable without reopening the accepted proposal. */
export function ProposalPaymentPlan({
  proposalId,
  initialPlan,
  initialVersion,
  total,
  canEdit,
  invoices,
  externalPayments,
}: Props) {
  const router = useRouter()
  const feedback = useFormFeedback({ successResetMs: 4_000 })
  const [plan, setPlan] = useState(initialPlan)
  const [version, setVersion] = useState(initialVersion)
  const [pending, startTransition] = useTransition()
  const invoiceByItem = new Map(invoices.map((invoice) => [invoice.planItemId, invoice]))
  const externalPaymentByItem = new Map(
    externalPayments.map((payment) => [payment.planItemId, payment]),
  )
  const lockedIds = [
    ...invoices.map((invoice) => invoice.planItemId),
    ...externalPayments.map((payment) => payment.planItemId),
  ]

  const prepareInvoice = (planItemId: string) => {
    feedback.setPending()
    startTransition(async () => {
      const result = await createInvoiceFromProposalPlanItem({ proposalId, planItemId })
      if (!result.ok) return feedback.setError(result.error)
      router.push(`/invoices/${result.id}/edit`)
    })
  }

  const recordExternalPayment = (planItemId: string) => {
    feedback.setPending()
    startTransition(async () => {
      const result = await createInvoiceFromProposalPlanItem({
        proposalId,
        planItemId,
        markPaidExternally: true,
      })
      if (!result.ok) return feedback.setError(result.error)
      feedback.setSuccess('Pago registrado')
      router.refresh()
    })
  }

  const save = () => {
    feedback.setPending()
    startTransition(async () => {
      const result = await updateProposalPaymentPlan({
        id: proposalId,
        expected_version: version,
        payment_plan: plan,
      })
      if (!result.ok) {
        feedback.setError(result.error)
        return
      }
      setVersion(result.version)
      feedback.setSuccess('Calendario de cobros guardado')
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendario de facturación</CardTitle>
        <p className="text-sm text-muted-foreground">
          Ajusta los próximos cobros sin modificar la propuesta aceptada. Los plazos ya facturados
          se gestionan desde su factura.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <PaymentPlanEditor
          plan={plan}
          total={total}
          onChange={setPlan}
          locked={!canEdit}
          lockedItemIds={lockedIds}
        />
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Plazo</th>
                <th className="px-3 py-2 text-right">Importe / saldo</th>
                <th className="px-3 py-2">Factura / estado</th>
                <th className="px-3 py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {plan.map((item) => {
                const invoice = invoiceByItem.get(item.id)
                const externalPayment = externalPaymentByItem.get(item.id)
                const amount = (total * item.percentage) / 100
                const paid = (invoice?.paid ?? 0) + (externalPayment?.amount ?? 0)
                return (
                  <tr key={item.id}>
                    <td className="px-3 py-2.5">
                      <span className="font-medium">{item.title}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{item.percentage}%</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatCurrency(amount)}
                      {paid > 0 ? (
                        <span className="block text-xs text-muted-foreground">
                          Cobrado {formatCurrency(paid)} · Pendiente{' '}
                          {formatCurrency(Math.max(0, amount - paid))}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      {invoice ? (
                        <Link
                          href={`/invoices/${invoice.id}`}
                          className="text-primary hover:underline"
                        >
                          {invoice.number} · {invoice.status}
                        </Link>
                      ) : externalPayment ? (
                        <span className="text-emerald-700">Pagado fuera del sistema</span>
                      ) : (
                        <span className="text-muted-foreground">Sin preparar</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {lockedIds.includes(item.id) ? null : (
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={!canEdit || pending}
                            onClick={() => recordExternalPayment(item.id)}
                          >
                            Marcar pagado
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!canEdit || pending}
                            onClick={() => prepareInvoice(item.id)}
                          >
                            Preparar borrador
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={save} disabled={pending}>
              Guardar calendario
            </Button>
            <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
