'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { usePasskeyVerification } from '@/components/security/use-passkey-verification'
import { Button } from '@/components/ui/button'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Select } from '@/components/ui/select'
import type { AccessScope, MemberRole } from '@/lib/auth'
import { ACCESS_SCOPE_OPTIONS, ROLE_OPTIONS } from '@/lib/permissions'
import { userVerificationScope } from '@/lib/security/user-verification-scope'

import {
  deactivateMember,
  deleteMember,
  reactivateMember,
  resendInvite,
  toggleLeadsAssignable,
  updateMemberRole,
} from './actions'

interface Props {
  memberId: string
  memberEmail: string
  role: MemberRole
  accessScope: AccessScope
  isSelf: boolean
  isDeactivated: boolean
  isPending: boolean
  actorRole: MemberRole
  leadsAssignable: boolean
}

export function MemberRowActions({
  memberId,
  memberEmail,
  role,
  accessScope,
  isSelf,
  isDeactivated,
  isPending,
  actorRole,
  leadsAssignable,
}: Props) {
  const [selectedRole, setSelectedRole] = useState(role)
  const [selectedScope, setSelectedScope] = useState(accessScope)
  const feedback = useFormFeedback()
  const router = useRouter()
  const { challenge, verifyWithPasskey } = usePasskeyVerification()
  const canEditOwner = actorRole === 'owner'
  const targetIsOwner = selectedRole === 'owner'
  const disabledRoleSelect = isSelf || isDeactivated || (targetIsOwner && !canEditOwner)
  const fullScopeRole = selectedRole === 'owner' || selectedRole === 'admin'
  const canDelete = actorRole === 'owner' && isDeactivated && !isSelf
  const canEditLeads = (actorRole === 'owner' || actorRole === 'admin') && !isDeactivated

  async function onRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as MemberRole
    if (next === selectedRole) return
    const nextScope: AccessScope =
      next === 'owner' || next === 'admin'
        ? 'all'
        : selectedRole === 'owner' || selectedRole === 'admin'
          ? 'assigned'
          : selectedScope
    feedback.setPending()
    const verification = await verifyWithPasskey(
      userVerificationScope(
        'team.member.role.update',
        `member:${memberId}:role:${next}:scope:${nextScope}`,
      ),
    )
    if (!verification.ok) {
      feedback.setError(verification.error)
      return
    }
    const res = await updateMemberRole({ memberId, role: next, accessScope: nextScope })
    if (!res.ok) {
      feedback.setError(res.error)
      return
    }
    setSelectedRole(next)
    setSelectedScope(nextScope)
    feedback.setSuccess('Acceso actualizado')
    router.refresh()
  }

  async function onScopeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as AccessScope
    if (next === selectedScope) return
    feedback.setPending()
    const verification = await verifyWithPasskey(
      userVerificationScope(
        'team.member.role.update',
        `member:${memberId}:role:${selectedRole}:scope:${next}`,
      ),
    )
    if (!verification.ok) {
      feedback.setError(verification.error)
      return
    }
    const res = await updateMemberRole({ memberId, role: selectedRole, accessScope: next })
    if (!res.ok) {
      feedback.setError(res.error)
      return
    }
    setSelectedScope(next)
    feedback.setSuccess('Alcance actualizado')
    router.refresh()
  }

  async function onToggleActive() {
    feedback.setPending()
    if (!isDeactivated) {
      const verification = await verifyWithPasskey(
        userVerificationScope('team.member.deactivate', `member:${memberId}`),
      )
      if (!verification.ok) {
        feedback.setError(verification.error)
        return
      }
    }
    const res = isDeactivated
      ? await reactivateMember({ memberId })
      : await deactivateMember({ memberId })
    if (!res.ok) {
      feedback.setError(res.error)
      return
    }
    feedback.setSuccess(isDeactivated ? 'Reactivado' : 'Desactivado')
    router.refresh()
  }

  async function onDelete() {
    const confirmed = window.confirm(
      `Eliminar permanentemente a ${memberEmail}?\n\nEsta acción no se puede deshacer. El email quedará libre para futuras invitaciones.`,
    )
    if (!confirmed) return
    feedback.setPending()
    const verification = await verifyWithPasskey(
      userVerificationScope('team.member.delete', `member:${memberId}`),
    )
    if (!verification.ok) {
      feedback.setError(verification.error)
      return
    }
    const res = await deleteMember({ memberId })
    if (!res.ok) {
      feedback.setError(res.error)
      return
    }
    feedback.setSuccess('Eliminado')
    router.refresh()
  }

  async function onResendInvite() {
    feedback.setPending()
    const res = await resendInvite({ memberId })
    if (!res.ok) {
      feedback.setError(res.error)
      return
    }
    feedback.setSuccess('Invitación reenviada')
  }

  async function onToggleLeadsAssignable() {
    feedback.setPending()
    const res = await toggleLeadsAssignable({ memberId, leadsAssignable: !leadsAssignable })
    if (!res.ok) {
      feedback.setError(res.error)
      return
    }
    feedback.setSuccess(leadsAssignable ? 'Excluido de leads' : 'Incluido en leads')
    router.refresh()
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {challenge}
      <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
      {canEditLeads ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={feedback.pending}
          onClick={onToggleLeadsAssignable}
          title={
            leadsAssignable
              ? 'Excluir del reparto automático de leads'
              : 'Incluir en el reparto automático de leads'
          }
        >
          {leadsAssignable ? 'Leads: sí' : 'Leads: no'}
        </Button>
      ) : null}
      {isPending ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={feedback.pending}
          onClick={onResendInvite}
        >
          Reenviar
        </Button>
      ) : null}
      <Select
        value={selectedRole}
        disabled={disabledRoleSelect || feedback.pending}
        className="h-8 w-36"
        onChange={onRoleChange}
        aria-label="Rol"
      >
        {ROLE_OPTIONS.filter((option) => canEditOwner || option.value !== 'owner').map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select
        value={fullScopeRole ? 'all' : selectedScope}
        disabled={isSelf || isDeactivated || fullScopeRole || feedback.pending}
        className="h-8 w-36"
        onChange={onScopeChange}
        aria-label="Alcance de registros"
        title={ACCESS_SCOPE_OPTIONS.find((option) => option.value === selectedScope)?.description}
      >
        {ACCESS_SCOPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isSelf || feedback.pending || (targetIsOwner && !canEditOwner)}
        onClick={onToggleActive}
      >
        {isDeactivated ? 'Reactivar' : 'Desactivar'}
      </Button>
      {canDelete ? (
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={feedback.pending}
          onClick={onDelete}
        >
          Eliminar
        </Button>
      ) : null}
    </div>
  )
}
