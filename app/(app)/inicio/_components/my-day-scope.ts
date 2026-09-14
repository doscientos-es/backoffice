import type { CurrentUser } from '@/lib/auth'
import { listActiveMembers, type MemberOption } from '@/lib/members/queries'

import type { MyDayScope } from './my-day-types'

type ScopeUser = Pick<CurrentUser, 'id' | 'name' | 'role'>

export function buildMyDayScope({
  user,
  member,
  members,
}: {
  user: ScopeUser
  member?: string | string[]
  members: MemberOption[]
}): MyDayScope {
  const canViewTeam = user.role === 'owner' || user.role === 'admin'
  const availableMembers = canViewTeam ? members : []
  const requestedMember = typeof member === 'string' ? member : ''
  const selectedMember = availableMembers.find((candidate) => candidate.id === requestedMember)
  const teamSelected = canViewTeam && requestedMember === 'team'
  const selectedName = teamSelected ? 'Equipo completo' : (selectedMember?.name ?? 'Mis tareas')

  return {
    canViewTeam,
    value: teamSelected ? 'team' : (selectedMember?.id ?? ''),
    label: selectedName,
    members: availableMembers.map(({ id, name }) => ({ id, name })),
  }
}

export async function getMyDayScope({
  user,
  member,
}: {
  user: ScopeUser
  member?: string | string[]
}): Promise<MyDayScope> {
  const canViewTeam = user.role === 'owner' || user.role === 'admin'
  const members = canViewTeam ? await listActiveMembers() : []

  return buildMyDayScope({ user, member, members })
}
