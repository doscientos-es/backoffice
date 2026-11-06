import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { EmailMarketingSequence, EmailMarketingStep } from '@/lib/marketing/email-marketing'

import { MarketingAnalytics, percent } from './analytics'

function step(id: number, overrides: Partial<EmailMarketingStep> = {}): EmailMarketingStep {
  return {
    id: `step-${id}`,
    sequence_id: 'sequence-1',
    position: id,
    title: `Correo ${id}`,
    subject: 'Asunto',
    preview_text: null,
    body_markdown: 'Mensaje',
    scheduled_at: '2026-01-01T10:00:00Z',
    status: 'sent',
    sent_at: `2026-01-${String(id).padStart(2, '0')}T10:00:00Z`,
    last_error: null,
    stats: {
      recipients: 10,
      sent: 10,
      delivered: 8,
      opened: id,
      clicked: 1,
      unsubscribed: 0,
      bounced: 0,
      complained: 0,
      converted: 0,
    },
    ...overrides,
  }
}

function sequence(steps: EmailMarketingStep[]): EmailMarketingSequence {
  return {
    id: 'sequence-1',
    list_id: 'list-1',
    list_name: 'Clientes',
    name: 'Bienvenida',
    status: 'active',
    created_at: '',
    steps,
  }
}

describe('rendimiento de emails', () => {
  it('muestra un estado vacío y tasas sin denominador sin inventar datos', () => {
    render(<MarketingAnalytics sequences={[]} />)
    expect(screen.getByText('Cuando completes un envío, verás aquí su evolución.')).toBeTruthy()
    expect(screen.getByText('— de enviados')).toBeTruthy()
    expect(percent(0, 0)).toBe('—')
    expect(percent(1, 8)).toBe('12,5 %')
  })

  it('suma toda la actividad y compara los seis últimos envíos finalizados con sus valores reales', () => {
    const pending = step(8, { status: 'sending', sent_at: null })
    render(
      <MarketingAnalytics
        sequences={[
          sequence([step(7), step(1), step(6), step(2), step(3), step(4), step(5), pending]),
        ]}
      />,
    )
    const sentMetric = screen.getByText('Enviados').parentElement?.parentElement
    expect(within(sentMetric!).getByText('80')).toBeTruthy()
    expect(screen.getByText('80 % de enviados')).toBeTruthy()
    const chart = screen.getByLabelText('Aperturas y clics por email finalizado')
    const links = within(chart).getAllByRole('link')
    expect(links).toHaveLength(6)
    expect(links[0]?.getAttribute('href')).toBe('/marketing/newsletters/steps/step-2')
    expect(links[5]?.getAttribute('href')).toBe('/marketing/newsletters/steps/step-7')
    expect(links[5]?.getAttribute('aria-label')).toContain('7 aperturas y 1 clic')
    expect(within(chart).queryByRole('link', { name: /Correo 8/ })).toBeNull()
  })
})
