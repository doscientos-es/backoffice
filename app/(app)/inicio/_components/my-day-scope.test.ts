import { describe, expect, it } from 'vitest'

import { buildMyDayScope } from './my-day-scope'

const user = { id: 'user-1', name: 'Ada Lovelace', role: 'admin' as const }
const members = [
  { id: 'user-1', name: 'Ada Lovelace', avatar_url: null, github_handle: null },
  { id: 'user-2', name: 'Grace Hopper', avatar_url: null, github_handle: null },
]

describe('my day scope', () => {
  it('builds the personal scope by default', () => {
    expect(buildMyDayScope({ user, members })).toMatchObject({
      canViewTeam: true,
      value: '',
      label: 'Mis tareas',
    })
  })

  it('builds team and member scopes from the query parameter', () => {
    expect(buildMyDayScope({ user, member: 'team', members })).toMatchObject({
      value: 'team',
      label: 'Equipo completo',
    })
    expect(buildMyDayScope({ user, member: 'user-2', members })).toMatchObject({
      value: 'user-2',
      label: 'Grace Hopper',
    })
  })

  it('ignores team scopes for users without team access', () => {
    expect(
      buildMyDayScope({
        user: { ...user, role: 'member' },
        member: 'team',
        members,
      }),
    ).toMatchObject({
      canViewTeam: false,
      value: '',
      label: 'Mis tareas',
      members: [],
    })
  })
})
