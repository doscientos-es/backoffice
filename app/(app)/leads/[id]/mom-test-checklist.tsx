'use client'

import { Check, X } from 'lucide-react'
import { useState, useTransition } from 'react'
import { sileo } from 'sileo'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import { updateLeadMomTestSignal } from '../actions'

const SIGNALS = [
  { key: 'real_problem', label: 'Tiene el problema real' },
  { key: 'aware_problem', label: 'Es consciente del problema' },
  { key: 'tried_solutions', label: 'Ha intentado solucionarlo' },
  { key: 'decision_power_or_budget', label: 'Tiene poder de decisión o presupuesto' },
  { key: 'accessible', label: 'Es accesible' },
] as const

type SignalKey = (typeof SIGNALS)[number]['key']
export type MomTestValues = Record<SignalKey, boolean | null>

/**
 * Checklist tri-estado (vacío / sí / no) con las 5 señales del Mom Test que
 * ayudan a detectar un buen lead. Cada fila persiste al instante vía
 * `updateLeadMomTestSignal`, con revert optimista si falla. Clicar el valor
 * ya activo lo vuelve a vaciar.
 */
export function MomTestChecklist({
  leadId,
  initialValues,
  canEdit,
}: {
  leadId: string
  initialValues: MomTestValues
  canEdit: boolean
}) {
  const [values, setValues] = useState(initialValues)
  const [, startTransition] = useTransition()

  const score = SIGNALS.filter((s) => values[s.key] === true).length

  function setSignal(key: SignalKey, next: boolean | null) {
    const prev = values[key]
    setValues((v) => ({ ...v, [key]: next }))
    startTransition(async () => {
      const res = await updateLeadMomTestSignal({ leadId, signal: key, value: next })
      if (!res.ok) {
        setValues((v) => ({ ...v, [key]: prev }))
        sileo.error({ title: res.error })
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs">Señales de un buen lead</p>
        <Badge variant={score >= 4 ? 'success' : score >= 2 ? 'warning' : 'neutral'}>
          {score}/5
        </Badge>
      </div>
      <ul className="flex flex-col gap-1.5">
        {SIGNALS.map((s) => {
          const value = values[s.key]
          return (
            <li key={s.key} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground truncate text-xs leading-snug">{s.label}</span>
              {canEdit ? (
                <span className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    aria-pressed={value === true}
                    aria-label={`${s.label}: sí`}
                    title={s.label}
                    onClick={() => setSignal(s.key, value === true ? null : true)}
                    className={cn(
                      'flex size-6 items-center justify-center rounded-md transition-colors',
                      value === true
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'text-muted-foreground/50 hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Check className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-pressed={value === false}
                    aria-label={`${s.label}: no`}
                    title={s.label}
                    onClick={() => setSignal(s.key, value === false ? null : false)}
                    className={cn(
                      'flex size-6 items-center justify-center rounded-md transition-colors',
                      value === false
                        ? 'bg-destructive/10 text-destructive'
                        : 'text-muted-foreground/50 hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ) : (
                <Badge
                  variant={value === true ? 'success' : value === false ? 'destructive' : 'neutral'}
                >
                  {value === true ? 'Sí' : value === false ? 'No' : '—'}
                </Badge>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
