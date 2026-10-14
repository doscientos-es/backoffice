export type FollowUpProposal = {
  status: string | null
  sent_at: string | null
  viewed_at: string | null
  valid_until: string | null
}

/** A view is a signal to resolve questions, never proof of buying intent. */
export function proposalFollowUp(proposal: FollowUpProposal, now = new Date()) {
  if (!['sent', 'viewed'].includes(proposal.status ?? '')) return null
  const sentAt = proposal.sent_at ? Date.parse(proposal.sent_at) : Number.NaN
  const hours = (now.getTime() - sentAt) / 3_600_000
  const expired = proposal.valid_until
    ? new Date(`${proposal.valid_until}T23:59:59`).getTime() < now.getTime()
    : false
  const viewed = Boolean(proposal.viewed_at) || proposal.status === 'viewed'
  const age =
    Number.isFinite(hours) && hours >= 0
      ? `Enviada hace ${Math.floor(hours / 24)} días`
      : 'Enviada · sin fecha registrada'
  return {
    label: expired
      ? 'Confirmar interés y revisar vigencia'
      : viewed
        ? 'Resolver dudas y acordar decisión'
        : 'Confirmar recepción de la propuesta',
    hint: `${age} · ${viewed ? 'vista por el cliente' : 'sin apertura registrada'}. ${
      expired ? 'Revisar condiciones antes de reenviarla.' : 'Acordar un siguiente paso con fecha.'
    }`,
    overdue: expired || hours >= 72,
  }
}
