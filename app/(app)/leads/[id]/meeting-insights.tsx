'use client'

import { CalendarClock, CircleCheck, ListPlus, LoaderCircle, UserX } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

import { createTask } from '../../tasks/actions'
import { dismissMeetingNoShow } from '../actions'

/** Shown when the lead was invited to an imported meeting but never joined. */
export function MeetingNoShowAlert({
  leadId,
  interactionId,
  canEdit,
}: {
  leadId: string
  interactionId: string
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function dismiss() {
    startTransition(async () => {
      const result = await dismissMeetingNoShow({ leadId, interactionId })
      if (!result.ok) {
        sileo.error({ title: result.error })
        return
      }
      router.refresh()
    })
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <UserX className="size-4 shrink-0 text-warning" aria-hidden />
        El lead no entró en la reunión.
      </p>
      <div className="flex items-center gap-2">
        {canEdit ? (
          <Button type="button" size="sm" variant="ghost" onClick={dismiss} disabled={pending}>
            Sí entró
          </Button>
        ) : null}
        <Button asChild size="sm" variant="outline">
          <a href={`/leads/${leadId}?feedback=schedule`}>
            <CalendarClock className="size-3.5" aria-hidden />
            Reagendar
          </a>
        </Button>
      </div>
    </div>
  )
}

/** Auto-created tasks for new imports; manual creation remains available for older meetings. */
export function MeetingNextSteps({
  leadId,
  steps,
  automaticTaskIds = null,
}: {
  leadId: string
  steps: string[]
  automaticTaskIds?: string[] | null
}) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(steps.map((_, i) => i)))
  const [pending, setPending] = useState(false)
  const [created, setCreated] = useState(false)

  if (automaticTaskIds !== null) {
    return (
      <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
        <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Próximos pasos
        </h4>
        <ul className="list-inside list-disc space-y-1 text-sm">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
        <p className="flex items-center gap-1.5 text-sm font-medium text-success">
          <CircleCheck className="size-4" aria-hidden />
          {automaticTaskIds.length} tareas creadas automáticamente
        </p>
        <div className="flex flex-wrap gap-2">
          {automaticTaskIds.map((id, index) => (
            <Button key={id} asChild variant="outline" size="sm">
              <Link href={`/tasks/${id}`}>Ver tarea {index + 1}</Link>
            </Button>
          ))}
        </div>
      </div>
    )
  }

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  async function create() {
    const chosen = steps.filter((_, index) => selected.has(index))
    if (chosen.length === 0) return
    setPending(true)
    const results = await Promise.all(
      chosen.map((title) =>
        createTask({
          title: title.slice(0, 200),
          lead_id: leadId,
          description: 'Creada desde el resumen de la reunión.',
        }),
      ),
    )
    setPending(false)
    const failed = results.filter((result) => !result.ok).length
    if (failed > 0) {
      sileo.error({ title: `No se pudieron crear ${failed} de ${chosen.length} tareas` })
      return
    }
    setCreated(true)
    sileo.success({
      title: chosen.length === 1 ? 'Tarea creada' : `${chosen.length} tareas creadas`,
    })
  }

  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
      <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Próximos pasos
      </h4>
      <ul className="mt-2 space-y-1.5">
        {steps.map((step, index) => (
          <li key={step} className="flex items-start gap-2">
            <Checkbox
              id={`next-step-${index}`}
              isSelected={selected.has(index)}
              onChange={() => toggle(index)}
              isDisabled={created || pending}
            />
            <label htmlFor={`next-step-${index}`} className="text-sm leading-snug">
              {step}
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-end">
        {created ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-success">
            <CircleCheck className="size-4" aria-hidden /> Tareas creadas
          </span>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={create}
            disabled={pending || selected.size === 0}
          >
            {pending ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <ListPlus className="size-3.5" aria-hidden />
            )}
            Crear {selected.size === 1 ? '1 tarea' : `${selected.size} tareas`}
          </Button>
        )}
      </div>
    </div>
  )
}
