import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('@/lib/auth', () => ({ requireUser: vi.fn(async () => ({})) }))
vi.mock('@/lib/marketing/email-marketing-calendar', () => ({
  getEmailMarketingCalendar: vi.fn(async () => [
    {
      sequence: {
        id: 's1',
        list_id: 'l1',
        list_name: 'Clientes',
        name: 'Bienvenida',
        status: 'paused',
      },
      step: {
        id: 'e1',
        title: 'Primer email',
        scheduled_at: '2026-06-10T10:00:00Z',
        status: 'scheduled',
      },
    },
  ]),
}))

import { getEmailMarketingCalendar } from '@/lib/marketing/email-marketing-calendar'

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

  it('filtra por mes en Madrid incluyendo los límites con horario de verano', async () => {
    vi.mocked(getEmailMarketingCalendar).mockResolvedValueOnce([
      {
        sequence: {
          id: 's1',
          list_id: 'l1',
          list_name: 'Lista',
          name: 'Secuencia',
          status: 'active',
        },
        step: {
          id: 'inside',
          title: 'En abril',
          scheduled_at: '2026-03-31T22:30:00Z',
          status: 'scheduled',
        },
      },
      {
        sequence: {
          id: 's1',
          list_id: 'l1',
          list_name: 'Lista',
          name: 'Secuencia',
          status: 'active',
        },
        step: {
          id: 'outside',
          title: 'En marzo',
          scheduled_at: '2026-03-31T21:30:00Z',
          status: 'scheduled',
        },
      },
    ])
    render(await MarketingCalendarPage({ searchParams: Promise.resolve({ month: '2026-04' }) }))
    expect(getEmailMarketingCalendar).toHaveBeenCalledWith(2026, 4)
    expect(screen.getAllByText('En abril')).toHaveLength(2)
    expect(screen.queryByText('En marzo')).toBeNull()
  })
})
