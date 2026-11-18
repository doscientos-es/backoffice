'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { useOptimisticUpdate } from '@/lib/hooks/use-optimistic-update'
import { leadSaleProductLabel, type LeadSaleProduct } from '@/lib/leads/sale-products'
import type { LeadStatusType } from '@/lib/schemas/lead'

import { updateLeadStatus } from '../actions'
import { CloseReasonDialog, type CloseReasonVariant } from '../close-reason-dialog'
import { QuotedSuggestionDialog } from '../quoted-suggestion-dialog'
import { WonProductDialog } from '../won-product-dialog'

const OPTIONS = [
  { value: 'new', label: 'Nuevo' },
  { value: 'contacted', label: 'Esperando respuesta' },
  { value: 'in_conversation', label: 'En conversación' },
  { value: 'quoted', label: 'Presupuestado' },
  { value: 'won', label: 'Ganado' },
  { value: 'lost', label: 'Perdido' },
  { value: 'not_interested', label: 'No interesa' },
  { value: 'archived', label: 'Archivado' },
] as const

/**
 * `qualifying` ya no se ofrece: solo se renderiza cuando el lead sigue en esa
 * etapa legacy, para que el select no quede sin valor seleccionado.
 */
const LEGACY_OPTION = { value: 'qualifying', label: 'En conversación (legacy)' } as const

const CLOSURE_VARIANTS: Record<string, CloseReasonVariant> = {
  lost: 'lost',
  not_interested: 'not_interested',
}

export function LeadStatusSelect({
  leadId,
  status,
  leadName,
  wonProduct,
}: {
  leadId: string
  status: string
  leadName: string
  wonProduct: LeadSaleProduct | null
}) {
  const { value, commit } = useOptimisticUpdate({ status: status as LeadStatusType, wonProduct })
  const currentStatus = value.status
  const [pendingClosure, setPendingClosure] = useState<CloseReasonVariant | null>(null)
  const [showWonProduct, setShowWonProduct] = useState(false)
  const [showQuotedSuggestion, setShowQuotedSuggestion] = useState(false)

  const apply = (
    to: LeadStatusType,
    options?: { lostReason?: string; wonProduct?: LeadSaleProduct | null },
  ) => {
    commit({ status: to, wonProduct: options?.wonProduct ?? null }, () =>
      updateLeadStatus({ leadId, status: to, ...options }),
    )
    if (to === 'quoted') setShowQuotedSuggestion(true)
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={currentStatus}
        aria-label="Estado del lead"
        className="h-8 w-40"
        onChange={(e) => {
          const next = e.target.value as LeadStatusType
          if (next === 'won') {
            setShowWonProduct(true)
            return
          }
          const variant = CLOSURE_VARIANTS[next]
          if (variant) {
            setPendingClosure(variant)
            return
          }
          apply(next)
        }}
      >
        {(currentStatus === 'qualifying' ? [LEGACY_OPTION, ...OPTIONS] : OPTIONS).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>

      {currentStatus === 'won' && (
        <Button type="button" variant="outline" size="sm" onClick={() => setShowWonProduct(true)}>
          {leadSaleProductLabel(value.wonProduct) ?? 'Asignar producto'}
        </Button>
      )}
      {showWonProduct && (
        <WonProductDialog
          name={leadName}
          product={value.wonProduct}
          editing={currentStatus === 'won'}
          onCancel={() => setShowWonProduct(false)}
          onConfirm={(product) => {
            setShowWonProduct(false)
            apply('won', { wonProduct: product })
          }}
        />
      )}

      <CloseReasonDialog
        lead={pendingClosure ? { id: leadId, name: leadName } : null}
        variant={pendingClosure ?? 'lost'}
        onCancel={() => setPendingClosure(null)}
        onConfirm={(reason) => {
          if (!pendingClosure) return
          const next = pendingClosure
          setPendingClosure(null)
          apply(next, { lostReason: reason })
        }}
      />

      <QuotedSuggestionDialog
        lead={showQuotedSuggestion ? { id: leadId, name: leadName } : null}
        onClose={() => setShowQuotedSuggestion(false)}
      />
    </div>
  )
}
