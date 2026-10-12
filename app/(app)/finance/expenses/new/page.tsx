import type { Metadata } from 'next'

import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { requirePagePermission } from '@/lib/auth'
import {
  getExpenseDetail,
  getExpenseProjectOptions,
  getExpenseTeamMembers,
  getExpenseVendorSuggestions,
} from '@/lib/finance/queries'

import { NewExpenseForm } from './new-expense-form'

export const metadata: Metadata = { title: 'Nuevo gasto · doscientos' }
export const dynamic = 'force-dynamic'

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  await requirePagePermission('finance.write')
  const { from } = await searchParams

  const [projects, teamMembers, sourceExpense, vendorSuggestions] = await Promise.all([
    getExpenseProjectOptions(),
    getExpenseTeamMembers(),
    from ? getExpenseDetail(from) : Promise.resolve(null),
    getExpenseVendorSuggestions(),
  ])

  const defaults = sourceExpense?.expense
    ? {
        vendor: sourceExpense.expense.vendor,
        description: sourceExpense.expense.description,
        category: sourceExpense.expense.category,
        status: sourceExpense.expense.status,
        recurrence: sourceExpense.expense.recurrence,
        currency: sourceExpense.expense.currency,
        subtotal: sourceExpense.expense.subtotal,
        tax_rate: sourceExpense.expense.tax_rate,
        vendor_nif: sourceExpense.expense.vendor_nif,
        invoice_reference: null, // don't copy invoice ref
        project_id: sourceExpense.expense.project_id,
        notes: sourceExpense.expense.notes,
        payment_source: sourceExpense.expense.payment_source,
        paid_by_member_id: sourceExpense.expense.paid_by_member_id,
      }
    : undefined

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={from ? 'Duplicar gasto' : 'Nuevo gasto'}
        description={
          from
            ? 'Copia basada en un gasto existente. Cambia lo que necesites.'
            : 'Registra un gasto operativo (Vercel, Supabase, dominios, software…).'
        }
        breadcrumbs={[
          { label: 'Finanzas', href: '/finance' },
          { label: 'Gastos', href: '/finance/expenses' },
          { label: from ? 'Duplicar gasto' : 'Nuevo gasto' },
        ]}
      />
      <Card>
        <CardContent className="pt-6">
          <NewExpenseForm
            projects={projects}
            teamMembers={teamMembers}
            defaults={defaults}
            vendorSuggestions={vendorSuggestions}
          />
        </CardContent>
      </Card>
    </div>
  )
}
