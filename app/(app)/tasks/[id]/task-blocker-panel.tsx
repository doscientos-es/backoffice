'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { BlockerBadge } from '@/components/tasks/blocker-badge'
import { Button } from '@/components/ui/button'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatDate } from '@/lib/utils'

import { setTaskBlocker } from '../blocker-actions'

export function TaskBlockerPanel({
  taskId,
  version,
  reason,
  blockedAt,
  ownerId,
  reviewOn,
  members,
  canEdit,
  closed,
}: {
  taskId: string
  version: number
  reason: string | null
  blockedAt: string | null
  ownerId: string | null
  reviewOn: string | null
  members: Array<{ id: string; name: string }>
  canEdit: boolean
  closed: boolean
}) {
  const router = useRouter()
  const feedback = useFormFeedback()
  const [value, setValue] = useState(reason ?? '')
  const prefix = `blocker-${taskId}`

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    await update(
      value.trim(),
      fields.get('ownerId')?.toString() || null,
      fields.get('reviewOn')?.toString() || null,
    )
  }

  async function update(
    nextReason: string | null,
    nextOwner: string | null,
    nextReview: string | null,
  ) {
    feedback.setPending()
    const result = await setTaskBlocker({
      taskId,
      expectedVersion: version,
      reason: nextReason,
      ownerId: nextOwner,
      reviewOn: nextReview,
    })
    if (!result.ok) {
      feedback.setError(result.error)
      if (result.code === 'conflict') router.refresh()
      return
    }
    feedback.setSuccess(nextReason ? 'Bloqueo guardado' : 'Tarea desbloqueada')
    router.refresh()
  }

  return (
    <section
      aria-labelledby={`${prefix}-heading`}
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${prefix}-heading`} className="text-sm font-semibold">
          Bloqueos
        </h2>
        <BlockerBadge reason={reason} />
      </div>
      {reason ? (
        <div className="mt-3 grid gap-2">
          <p className="text-sm whitespace-pre-wrap">{reason}</p>
          <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <div>
              <dt>Desde</dt>
              <dd className="text-foreground">{formatDate(blockedAt)}</dd>
            </div>
            <div>
              <dt>Quién puede desbloquear</dt>
              <dd className="text-foreground">
                {members.find((member) => member.id === ownerId)?.name ?? 'Sin responsable'}
              </dd>
            </div>
            <div>
              <dt>Revisar el</dt>
              <dd className="text-foreground">{reviewOn ? formatDate(reviewOn) : 'Sin fecha'}</dd>
            </div>
          </dl>
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={feedback.pending}
              onClick={() => void update(null, null, null)}
            >
              Desbloquear tarea
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {closed ? 'Tarea cerrada.' : 'Sin bloqueos. La tarea puede avanzar.'}
        </p>
      )}
      {canEdit && !closed ? (
        <details className="mt-3">
          <summary className="w-fit cursor-pointer rounded text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-4">
            {reason ? 'Editar bloqueo' : 'Bloquear tarea'}
          </summary>
          <form onSubmit={save} className="mt-3 grid gap-3">
            <p id={`${prefix}-help`} className="text-xs text-muted-foreground">
              Es interno y no cambia el estado de la tarea. No incluyas contraseñas ni credenciales.
            </p>
            <div className="grid gap-1.5">
              <label htmlFor={`${prefix}-reason`} className="text-sm font-medium">
                ¿Qué impide avanzar?
              </label>
              <Textarea
                id={`${prefix}-reason`}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                required
                maxLength={1000}
                rows={3}
                aria-describedby={`${prefix}-help`}
                placeholder="Falta que el cliente confirme el diseño…"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label htmlFor={`${prefix}-owner`} className="text-sm font-medium">
                  Quién puede desbloquear{' '}
                  <span className="font-normal text-muted-foreground">(opcional)</span>
                </label>
                <Select id={`${prefix}-owner`} name="ownerId" defaultValue={ownerId ?? ''}>
                  <option value="">Sin responsable</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-1.5">
                <label htmlFor={`${prefix}-review`} className="text-sm font-medium">
                  Revisar el <span className="font-normal text-muted-foreground">(opcional)</span>
                </label>
                <Input
                  id={`${prefix}-review`}
                  name="reviewOn"
                  type="date"
                  defaultValue={reviewOn ?? ''}
                />
              </div>
            </div>
            <Button
              type="submit"
              size="sm"
              className="w-fit"
              disabled={feedback.pending || !value.trim()}
            >
              {feedback.pending ? 'Guardando…' : 'Guardar bloqueo'}
            </Button>
          </form>
        </details>
      ) : null}
      <div className="mt-2">
        <FormFeedback state={feedback.state} />
      </div>
    </section>
  )
}
