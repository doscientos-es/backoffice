import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  rpc: vi.fn(),
  deleted: vi.fn(),
  inserted: vi.fn(),
  teamError: null as { message: string } | null,
  teamThrows: false,
}))
vi.mock('@/lib/auth', () => ({ requireUser: vi.fn(async () => ({ id: 'member' })) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    rpc: db.rpc,
    from(table: string) {
      if (table === 'team_members' && db.teamThrows) throw new Error('Connection failed')
      const query = {
        select: () => query,
        eq: () => query,
        is: () => query,
        in: () => query,
        delete: () => {
          db.deleted(table)
          return query
        },
        insert: (value: unknown) => {
          db.inserted(table, value)
          return query
        },
        maybeSingle: async () => ({
          data: {
            status: 'draft',
            created_at: '2026-01-01',
            payment_schedule: 'half_half',
            payment_terms: null,
          },
          error: null,
        }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({
            data: table === 'team_members' ? [{ id: MEMBER }] : null,
            error: db.teamError,
          }).then(resolve),
      }
      return query
    },
  })),
}))

import { saveProposalEditorDraft } from './editor-save'

const ID = '494d62cb-fd56-4650-b131-9e3a927a20ad'
const MEMBER = 'dc1d6a20-5a5e-46da-a389-cee93f65aee2'
const input = {
  id: ID,
  expected_version: 1,
  title: 'Propuesta',
  team_member_ids: [MEMBER],
  items: [{ description: 'Servicio', quantity: 1, unit_price: 100, tax_rate: 21, position: 0 }],
}

describe('saveProposalEditorDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.teamError = null
    db.teamThrows = false
    db.rpc.mockResolvedValue({ data: [{ version: 2 }], error: null })
  })
  it('saves the proposal and its team and returns the new version', async () => {
    expect(await saveProposalEditorDraft(input)).toEqual({ ok: true, version: 2 })
    expect(db.inserted).toHaveBeenCalledWith('proposal_team_members', [
      { proposal_id: ID, member_id: MEMBER, position: 0 },
    ])
  })
  it('does not write the team when the proposal has a version conflict', async () => {
    db.rpc.mockResolvedValue({ data: null, error: { message: 'VERSION_CONFLICT' } })
    expect(await saveProposalEditorDraft(input)).toMatchObject({ ok: false, code: 'conflict' })
    expect(db.deleted).not.toHaveBeenCalled()
    expect(db.inserted).not.toHaveBeenCalled()
  })
  it('returns the saved version when the team cannot be updated', async () => {
    db.teamError = { message: 'No disponible' }
    expect(await saveProposalEditorDraft(input)).toMatchObject({
      ok: false,
      version: 2,
      error: expect.stringContaining('La propuesta se guardó'),
    })
  })
  it('rejects invalid team IDs before changing the proposal', async () => {
    expect(await saveProposalEditorDraft({ ...input, team_member_ids: ['invalid'] })).toMatchObject(
      { ok: false },
    )
    expect(db.rpc).not.toHaveBeenCalled()
    expect(db.deleted).not.toHaveBeenCalled()
  })
  it('preserves the saved version when the team write throws', async () => {
    db.teamThrows = true
    expect(await saveProposalEditorDraft(input)).toMatchObject({
      ok: false,
      version: 2,
      error: expect.stringContaining('La propuesta se guardó'),
    })
  })
})
