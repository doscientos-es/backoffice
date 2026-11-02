import type { LeadDetailInteraction } from './types'

type TeamMember = { id: string; name: string }

export type LeadOwnerSuggestion = {
  member: TeamMember
  actionLabels: string[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function qualifyingAction(interaction: LeadDetailInteraction): string | null {
  const payload = asRecord(interaction.payload)
  if (!payload || !interaction.performed_by) return null
  if (interaction.type === 'call') return 'Llamada'
  if (interaction.type === 'email_sent') {
    // Bulk campaign and workflow sends should not count as personal follow-up.
    return payload.campaign_id || payload.automation_id ? null : 'Email enviado'
  }
  if (interaction.type === 'meeting') {
    const artifacts = asRecord(payload.meet_artifacts)
    return typeof artifacts?.actual_end === 'string' ? 'Reunión realizada' : null
  }
  return null
}

/** Suggest an owner only when the same non-owner performed the latest 3 sales actions. */
export function suggestLeadOwner(input: {
  interactions: LeadDetailInteraction[]
  members: TeamMember[]
  currentAssigneeId: string | null
}): LeadOwnerSuggestion | null {
  const memberById = new Map(input.members.map((member) => [member.id, member]))
  const latestActions = input.interactions
    .map((interaction) => ({
      memberId: interaction.performed_by,
      label: qualifyingAction(interaction),
      createdAt: interaction.created_at,
    }))
    .filter((action): action is { memberId: string; label: string; createdAt: string } =>
      Boolean(action.memberId && action.label),
    )
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 3)

  if (latestActions.length !== 3) return null
  const memberId = latestActions[0]?.memberId
  if (
    !memberId ||
    memberId === input.currentAssigneeId ||
    latestActions.some((action) => action.memberId !== memberId)
  )
    return null

  const member = memberById.get(memberId)
  if (!member) return null
  return { member, actionLabels: latestActions.map((action) => action.label) }
}
