import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { can, ROLE_PERMISSIONS } from './permissions'

const migration = readFileSync(
  'supabase/migrations/20261004120100_role_permissions_and_scoped_rls.sql',
  'utf8',
)

describe('role permissions', () => {
  it('matches the permission bundles seeded by the database migration', () => {
    for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      const seed = migration.match(new RegExp(`\\('${role}', array\\[(.*?)\\]\\)`, 's'))?.[1]
      expect(seed, `missing SQL permission seed for ${role}`).toBeDefined()
      const sqlPermissions = [...(seed?.matchAll(/'([a-z.]+)'/g) ?? [])].map((match) => match[1])
      expect(sqlPermissions.sort(), `permission drift for ${role}`).toEqual([...permissions].sort())
    }
  })

  it('keeps delivery away from pricing and finance while granting operational delivery access', () => {
    expect(can('delivery', 'projects.write')).toBe(true)
    expect(can('delivery', 'tasks.write')).toBe(true)
    expect(can('delivery', 'proposals.prices')).toBe(false)
    expect(can('delivery', 'finance.read')).toBe(false)
  })
})
