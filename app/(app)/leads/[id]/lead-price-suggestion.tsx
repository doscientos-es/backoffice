'use client'

import { Check, Euro, FileText, LoaderCircle, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { type PriceSuggestion, toProposalLines } from '@/lib/leads/price-suggestion'
import { readJsonResponse } from '@/lib/utils/http'

import { createProposalAction } from '../../proposals/actions'
import { updateLeadEstimatedValue } from '../actions'

type Props = {
  leadId: string
  leadLabel: string
  currentValue: number | null
  canEdit: boolean
  /** Solo se ofrece crear la propuesta si el lead aún no tiene ninguna. */
  canCreateProposal: boolean
}

const eur = (value: number) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)

export function LeadPriceSuggestion({
  leadId,
  leadLabel,
  currentValue,
  canEdit,
  canCreateProposal,
}: Props) {
  const router = useRouter()
  const [suggestion, setSuggestion] = useState<PriceSuggestion | null>(null)
  const [busy, setBusy] = useState(false)
  const [applied, setApplied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setBusy(true)
    setError(null)
    setApplied(false)
    try {
      const response = await fetch('/api/crm/ai/suggest-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId }),
      })
      const json = await readJsonResponse<PriceSuggestion & { error?: string }>(
        response,
        'No se pudo estimar el precio.',
      )
      if (!response.ok) throw new Error(json.error ?? 'No se pudo estimar el precio.')
      setSuggestion(json)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo estimar el precio.')
    } finally {
      setBusy(false)
    }
  }

  async function apply() {
    if (!suggestion) return
    setBusy(true)
    setError(null)
    const result = await updateLeadEstimatedValue({ leadId, value: suggestion.recommended })
    setBusy(false)
    if (!result.ok) return setError(result.error ?? 'No se pudo guardar el valor estimado.')
    setApplied(true)
    router.refresh()
  }

  async function createProposal() {
    if (!suggestion) return
    setBusy(true)
    setError(null)
    try {
      const result = await createProposalAction({
        lead_id: leadId,
        title: `Propuesta · ${leadLabel}`.slice(0, 200),
        notes: suggestion.scope_summary.slice(0, 4000),
        items: toProposalLines(suggestion, suggestion.vat_rate),
      })
      if (!result.ok) throw new Error(result.error)
      router.push(`/proposals/${result.id}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo crear la propuesta.')
      setBusy(false)
    }
  }

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-border/70 bg-muted/20 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
            <Euro className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <CardTitle className="truncate text-sm font-semibold">Precio orientativo</CardTitle>
            <p className="truncate text-xs text-muted-foreground">
              {currentValue != null
                ? `Valor estimado actual: ${eur(currentValue)}`
                : 'Sin valor estimado'}
            </p>
          </div>
        </div>
        {canEdit ? (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={generate}>
            {busy && !suggestion ? (
              <LoaderCircle className="size-3.5 motion-safe:animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {suggestion ? 'Recalcular' : 'Sugerir precio'}
          </Button>
        ) : null}
      </CardHeader>
      {suggestion || error ? (
        <CardContent className="flex flex-col gap-3 pt-4">
          {suggestion ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-2xl leading-none font-semibold tabular-nums">
                    {eur(suggestion.recommended)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Rango {eur(suggestion.min)} – {eur(suggestion.max)} · {suggestion.hours_min}–
                    {suggestion.hours_max} h a {eur(suggestion.hourly_rate)}/h
                  </p>
                </div>
                <Badge variant="outline">
                  Confianza {Math.round(suggestion.confidence * 100)}%
                </Badge>
              </div>
              <p className="text-sm leading-relaxed">{suggestion.scope_summary}</p>
              <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/70 text-xs">
                {suggestion.items.map((item) => (
                  <li
                    key={item.name}
                    className="flex items-center justify-between gap-3 px-2.5 py-1.5"
                  >
                    <span className="min-w-0 truncate">{item.name}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {item.hours_min}–{item.hours_max} h · {eur(item.price_min)}–
                      {eur(item.price_max)}
                    </span>
                  </li>
                ))}
              </ul>
              {suggestion.assumptions.length ? (
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Supuestos</p>
                  <ul className="mt-0.5 list-disc pl-4">
                    {suggestion.assumptions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {suggestion.missing_info.length ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-800 dark:text-amber-300">
                  <p className="font-medium">Cambiaría el precio si se aclara:</p>
                  <ul className="mt-0.5 list-disc pl-4">
                    {suggestion.missing_info.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {canEdit || canCreateProposal ? (
                <div className="flex flex-wrap gap-2">
                  {canCreateProposal ? (
                    <Button type="button" size="sm" disabled={busy} onClick={createProposal}>
                      <FileText className="size-3.5" />
                      Crear propuesta con estas partidas
                    </Button>
                  ) : null}
                  {canEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy || applied}
                      onClick={apply}
                    >
                      {applied ? <Check className="size-3.5" /> : null}
                      {applied
                        ? 'Aplicado'
                        : `Usar ${eur(suggestion.recommended)} como valor estimado`}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
          {error ? (
            <p
              role="status"
              className="rounded-md bg-destructive/10 px-2.5 py-2 text-xs text-destructive"
            >
              {error}
            </p>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  )
}
