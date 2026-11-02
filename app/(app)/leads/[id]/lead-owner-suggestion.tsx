'use client'

import { Activity, UserRound, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'
import type { LeadOwnerSuggestion } from '@/lib/leads/owner-suggestion'

import { assignLeadOwner } from '../actions'

export function LeadOwnerSuggestionCard({
  leadId,
  currentOwnerName,
  suggestion,
}: {
  leadId: string
  currentOwnerName: string | null
  suggestion: LeadOwnerSuggestion
}) {
  const [busy, startTransition] = useTransition()
  const [dismissed, setDismissed] = useState(false)
  const router = useRouter()

  function assignSuggestedOwner() {
    startTransition(async () => {
      const result = await assignLeadOwner({ leadId, assigneeId: suggestion.member.id })
      if (!result.ok) {
        sileo.error({ title: result.error })
        return
      }
      sileo.success({ title: `${suggestion.member.name} ahora es responsable del lead` })
      router.refresh()
    })
  }

  if (dismissed) return null

  return (
    <section className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.035] p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Activity className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">Sugerencia de responsable</h3>
            <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Sugerencia
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Las 3 últimas acciones comerciales las ha realizado {suggestion.member.name}
            {currentOwnerName
              ? `; ${currentOwnerName} figura como responsable.`
              : ', y el lead aún no tiene responsable.'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <UserRound className="size-3.5" /> 3 acciones seguidas
            </span>
            <span>{suggestion.actionLabels.join(' · ')}</span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <Button
              type="button"
              className="min-h-11"
              disabled={busy}
              onClick={assignSuggestedOwner}
            >
              Asignar a {suggestion.member.name}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={busy}
              onClick={() => setDismissed(true)}
            >
              Ahora no
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              disabled={busy}
              onClick={() => setDismissed(true)}
            >
              <X className="size-4" /> Cerrar
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
