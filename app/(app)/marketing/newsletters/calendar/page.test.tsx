import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('@/lib/auth', () => ({ requireUser: vi.fn(async () => ({})) }))
vi.mock('@/lib/marketing/email-marketing', () => ({
  getEmailMarketingOverview: vi.fn(async () => ({
    sequences: [
      {
        id: 's1',
        list_id: 'l1',
        list_name: 'Clientes',
        name: 'Bienvenida',
        status: 'paused',
        steps: [
          {
            id: 'e1',
            title: 'Primer email',
            scheduled_at: '2026-06-10T10:00:00Z',
            status: 'scheduled',
          },
        ],
      },
    ],
  })),
}))

import MarketingCalendarPage from './page'

describe('calendario de emails', () => {
  it('muestra fecha, secuencia pausada y navegación de mes', async () => {
    render(await MarketingCalendarPage({ searchParams: Promise.resolve({ month: '2026-06' }) }))
    expect(screen.getByText('junio de 2026')).toBeTruthy()
    expect(screen.getByText('Secuencia pausada')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Siguiente' }).getAttribute('href')).toBe(
      '/marketing/newsletters/calendar?month=2026-07',
    )
    expect(screen.getAllByRole('link', { name: /Primer email/ })[0]?.getAttribute('href')).toBe(
      '/marketing/newsletters?list=l1&sequence=s1',
    )
  })
})
