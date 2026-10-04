'use client'

import { useRef, useState } from 'react'

import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SubmitButton } from '@/components/ui/submit-button'
import type { AccessScope, MemberRole } from '@/lib/auth'
import { ACCESS_SCOPE_OPTIONS, ROLE_OPTIONS } from '@/lib/permissions'

import { inviteTeamMember } from './actions'

interface Props {
  actorRole: MemberRole
}

export function InviteForm({ actorRole }: Props) {
  const feedback = useFormFeedback()
  const formRef = useRef<HTMLFormElement>(null)
  const [role, setRole] = useState<MemberRole>('member')
  const [accessScope, setAccessScope] = useState<AccessScope>('assigned')
  const fullScopeRole = role === 'owner' || role === 'admin'

  function handleRoleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextRole = event.target.value as MemberRole
    setRole(nextRole)
    setAccessScope((current) =>
      nextRole === 'owner' || nextRole === 'admin'
        ? 'all'
        : role === 'owner' || role === 'admin'
          ? 'assigned'
          : current,
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    feedback.setPending()
    try {
      const result = await inviteTeamMember(fd)
      if (result.ok) {
        feedback.setSuccess('Invitación enviada')
        formRef.current?.reset()
      } else {
        feedback.setError(result.error || 'No se pudo enviar la invitación.')
      }
    } catch (err) {
      feedback.setError(err instanceof Error ? err.message : 'Error inesperado al invitar.')
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_180px_180px]">
        <Field>
          <FieldLabel htmlFor="invite_name" className="text-xs font-medium">
            Nombre <span className="font-normal text-muted-foreground">(opcional)</span>
          </FieldLabel>
          <Input
            id="invite_name"
            name="name"
            placeholder="Se completa en el onboarding"
            autoComplete="name"
            maxLength={120}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="invite_email" className="text-xs font-medium">
            Email <span className="text-destructive">*</span>
          </FieldLabel>
          <Input
            id="invite_email"
            name="email"
            type="email"
            inputMode="email"
            required
            placeholder="nombre@gmail.com"
            autoComplete="email"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="invite_role" className="text-xs font-medium">
            Rol <span className="text-destructive">*</span>
          </FieldLabel>
          <Select id="invite_role" name="role" value={role} onChange={handleRoleChange}>
            {ROLE_OPTIONS.filter((option) => actorRole === 'owner' || option.value !== 'owner').map(
              (option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ),
            )}
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="invite_scope" className="text-xs font-medium">
            Alcance
          </FieldLabel>
          <Select
            id="invite_scope"
            name="accessScope"
            value={accessScope}
            disabled={fullScopeRole}
            onChange={(event) => setAccessScope(event.target.value as AccessScope)}
          >
            {ACCESS_SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <FieldDescription>
            {fullScopeRole
              ? 'Este rol siempre tiene acceso a todos los registros.'
              : 'Se puede cambiar más adelante.'}
          </FieldDescription>
        </Field>
      </div>
      <FieldDescription>
        El invitado recibirá un enlace para activar su cuenta y, a partir de ahí, entrará con{' '}
        <strong>Continuar con Google</strong>. Caduca a las 72&nbsp;horas.
      </FieldDescription>
      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        <FormFeedback
          state={feedback.state}
          pendingLabel="Enviando…"
          successLabel="Invitación enviada"
        />
        <SubmitButton pendingLabel="Enviando…" loading={feedback.pending}>
          Enviar invitación
        </SubmitButton>
      </div>
    </form>
  )
}
