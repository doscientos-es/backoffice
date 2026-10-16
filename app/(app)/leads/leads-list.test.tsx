import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LeadListItem } from '@/lib/leads/types'
import { leadFixture } from '@/tests/fixtures/leads'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ prefetch: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/leads',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('./actions', () => ({
  bulkAssignLeadsToMe: vi.fn(),
  bulkCreateLeadTasks: vi.fn(),
  bulkScheduleLeadReminders: vi.fn(),
  bulkUpdateLeadStatus: vi.fn(),
}))
vi.mock('./lead-fast-actions', () => ({ LeadFastActions: () => null }))
vi.mock('./[id]/phone-actions', () => ({ LeadCallLink: () => null }))
vi.mock('./lead-quick-view', () => ({
  LeadQuickView: ({ lead }: { lead: LeadListItem | null }) => (
    <output aria-label="Lead seleccionado">{lead?.id ?? ''}</output>
  ),
}))

import { LeadsList } from './leads-list'

describe('responsive lead list', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-16T10:00:00.000Z'))
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  function renderList(lead = leadFixture()) {
    return render(
      <LeadsList
        title="Leads"
        empty="Sin leads"
        leads={[lead]}
        columns={[
          { key: 'nombre', label: 'Nombre' },
          { key: 'proxima_accion', label: 'Próxima acción' },
        ]}
      />,
    )
  }

  it('opens the same quick view from a mobile card as from the desktop row', () => {
    renderList()
    fireEvent.click(
      screen.getByRole('button', { name: 'Abrir ficha rápida de Contacto de ejemplo' }),
    )
    expect(screen.getByLabelText('Lead seleccionado').textContent).toBe('lead-example')
  })

  it('shows the booked meeting in both the desktop table and mobile card', () => {
    renderList(leadFixture({ scheduled_meeting_at: '2026-10-20T10:00:00.000Z' }))
    expect(within(screen.getByRole('table')).getByText(/Reunión agendada/)).toBeTruthy()
    expect(screen.getAllByText(/Reunión agendada/)).toHaveLength(2)
    expect(
      screen.getAllByRole('checkbox', { name: 'Seleccionar Contacto de ejemplo' }),
    ).toHaveLength(2)
  })
})
