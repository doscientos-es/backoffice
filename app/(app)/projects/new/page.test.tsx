import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import NewProjectPage from '@/app/(app)/projects/new/page'

const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: { lead_id: 'lead-123' }, error: null }),
  order: vi.fn().mockResolvedValue({
    data: [{ id: 'lead-123', name: 'Lead 123' }],
    error: null,
  }),
}

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(() => Promise.resolve({})),
}))

describe('NewProjectPage pre-fill', () => {
  it.each([{ lead_id: 'lead-123' }, { client_id: 'legacy-123' }])(
    'pre-fills the lead from %j',
    async (params) => {
      const searchParams = Promise.resolve(params)
      const jsx = await NewProjectPage({ searchParams })
      render(jsx)
      const select = screen.getByRole('combobox', { name: /^Lead\b/i }) as HTMLSelectElement
      expect(select.value).toBe('lead-123')
    },
  )

  it('defaults to no lead when searchParams is empty', async () => {
    const searchParams = Promise.resolve({})
    const jsx = await NewProjectPage({ searchParams })
    render(jsx)
    const select = screen.getByRole('combobox', { name: /^Lead\b/i }) as HTMLSelectElement
    expect(select.value).toBe('')
  })
})
