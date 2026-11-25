import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({ state: { failedTable: '' } }))
vi.mock('@/lib/auth', () => ({ requireUser: vi.fn(async () => ({})) }))
vi.mock('@/lib/env', () => ({ isAIEnabled: () => false }))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from: (table: string) => {
      const query = {
        select: () => query,
        is: () => query,
        not: () => query,
        order: async () => ({
          data: [],
          error: state.failedTable === table ? { message: 'error' } : null,
        }),
      }
      return query
    },
  }),
}))
vi.mock('./new-proposal-form', () => ({ NewProposalForm: () => <div>Formulario disponible</div> }))

import NewProposalPage from './page'

describe('NewProposalPage', () => {
  beforeEach(() => {
    state.failedTable = ''
  })

  it('shows the form when all lookups succeed', async () => {
    render(await NewProposalPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByText('Formulario disponible')).toBeDefined()
  })

  it.each(['leads', 'projects'])(
    'explains a %s lookup failure instead of showing empty options',
    async (table) => {
      state.failedTable = table
      render(await NewProposalPage({ searchParams: Promise.resolve({}) }))
      expect(
        screen.getByText('No se pudieron cargar los datos para crear la propuesta'),
      ).toBeDefined()
      expect(screen.queryByText('Formulario disponible')).toBeNull()
    },
  )
})
