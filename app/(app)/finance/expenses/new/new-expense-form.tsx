'use client'

import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import type { ExpenseInvoiceSuggestion } from '@/lib/finance/invoice-extraction'
import type { VendorSuggestion } from '@/lib/finance/types'
import { useActionForm } from '@/lib/hooks/use-action-form'

import { createExpense } from '../actions'
import { type ExpenseFormDefaults, ExpenseFormFields } from '../expense-form-fields'
import { ExpenseInvoiceUpload } from './expense-invoice-upload'

interface Props {
  projects: Array<{ id: string; name: string; clientName?: string | null }>
  teamMembers: Array<{ id: string; name: string }>
  defaults?: ExpenseFormDefaults
  vendorSuggestions?: VendorSuggestion[]
}

/** Reads the live form values so an extraction never discards user edits. */
function snapshotDefaults(form: HTMLFormElement | null): ExpenseFormDefaults {
  const current: Record<string, string> = {}
  if (form) {
    for (const [key, value] of new FormData(form).entries()) {
      if (typeof value === 'string') current[key] = value
    }
  }
  const get = (key: string) => current[key] || undefined
  return {
    vendor: get('vendor'),
    description: get('description'),
    category: get('category'),
    status: get('status'),
    recurrence: get('recurrence'),
    expense_date: get('expense_date'),
    due_date: get('due_date'),
    paid_at: get('paid_at'),
    currency: get('currency'),
    subtotal: get('subtotal'),
    tax_rate: get('tax_rate'),
    vendor_nif: get('vendor_nif'),
    invoice_reference: get('invoice_reference'),
    project_id: get('project_id'),
    notes: get('notes'),
    payment_source: get('payment_source'),
    paid_by_member_id: get('paid_by_member_id'),
  }
}

export function NewExpenseForm({ projects, teamMembers, defaults, vendorSuggestions = [] }: Props) {
  // createExpense redirects on success, so we only ever surface its error.
  const { state, pending, onSubmit } = useActionForm(createExpense)
  const error = state.status === 'error' ? state.message : null

  const formRef = useRef<HTMLFormElement>(null)
  const [invoice, setInvoice] = useState<{ id: string; name: string } | null>(null)
  const [invoicePending, setInvoicePending] = useState(false)
  const [fieldsKey, setFieldsKey] = useState(0)
  const [fieldDefaults, setFieldDefaults] = useState<ExpenseFormDefaults | undefined>(defaults)

  /**
   * Applies the extracted invoice data on top of the current form values. The
   * field block is uncontrolled (defaultValue), so it is remounted with a
   * fresh key for the new defaults to take effect.
   */
  function applySuggestion(suggestion: ExpenseInvoiceSuggestion) {
    const merged = snapshotDefaults(formRef.current)
    if (suggestion.vendor) merged.vendor = suggestion.vendor
    if (suggestion.description) merged.description = suggestion.description
    if (suggestion.expense_date) merged.expense_date = suggestion.expense_date
    if (suggestion.due_date) merged.due_date = suggestion.due_date
    if (suggestion.subtotal !== null) merged.subtotal = String(suggestion.subtotal)
    if (suggestion.tax_rate !== null) merged.tax_rate = String(suggestion.tax_rate)
    if (suggestion.vendor_nif) merged.vendor_nif = suggestion.vendor_nif
    if (suggestion.invoice_reference) merged.invoice_reference = suggestion.invoice_reference

    // A vendor we've seen before also brings its usual category / payment source.
    const known = merged.vendor
      ? vendorSuggestions.find(
          (s) => s.vendor.trim().toLowerCase() === String(merged.vendor).trim().toLowerCase(),
        )
      : undefined
    if (known) {
      merged.category = known.category
      merged.payment_source = known.payment_source
      if (!merged.vendor_nif && known.vendor_nif) merged.vendor_nif = known.vendor_nif
    }

    setFieldDefaults(merged)
    setFieldsKey((k) => k + 1)
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-5">
      <ExpenseInvoiceUpload
        onAttached={setInvoice}
        onExtracted={(suggestion) => applySuggestion(suggestion)}
        onPendingChange={setInvoicePending}
      />
      {/* Linked to the expense by createExpense once the row exists. */}
      <input type="hidden" name="invoice_attachment_id" value={invoice?.id ?? ''} />
      <ExpenseFormFields
        key={fieldsKey}
        autoFocusVendor={fieldsKey === 0}
        projects={projects}
        teamMembers={teamMembers}
        defaults={fieldDefaults}
        vendorSuggestions={vendorSuggestions}
      />
      {error && (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <div className="border-border flex justify-end border-t pt-4">
        <Button type="submit" size="sm" disabled={pending || invoicePending}>
          {pending ? 'Creando…' : 'Crear gasto'}
        </Button>
      </div>
    </form>
  )
}
