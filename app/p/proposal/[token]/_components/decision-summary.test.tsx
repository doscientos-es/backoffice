import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { computeProposalTotals } from '@/lib/finance'
import { formatPortalEUR } from '@/lib/portal/language'

import { makeTr, type PortalLanguage } from '../_lib/i18n'
import { DecisionSummary } from './decision-summary'

vi.mock('../actions', () => ({ trackPortalEngagement: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const baseProps = {
  language: 'es' as const,
  tr: makeTr('es'),
  totals: computeProposalTotals([
    { quantity: 1, unit_price: 1000, vat_rate: 21, billing_cycle: 'none' },
    { quantity: 1, unit_price: 100, vat_rate: 21, billing_cycle: 'monthly' },
  ]),
  canRespond: true,
}

describe('DecisionSummary', () => {
  it.each<{ language: PortalLanguage; label: string; detail: string }>([
    { language: 'es', label: 'Inversión', detail: 'Ver desglose de la inversión' },
    { language: 'ca', label: 'Inversió', detail: 'Veure desglossament de la inversió' },
    { language: 'en', label: 'Investment', detail: 'View investment breakdown' },
  ])(
    'links the initial investment before tax to its breakdown in $language',
    ({ language, label, detail }) => {
      render(<DecisionSummary {...baseProps} language={language} tr={makeTr(language)} />)

      expect(screen.getByText(label)).toBeDefined()
      const link = screen.getByRole('link', { name: new RegExp(detail) })
      expect(link.getAttribute('href')).toBe('#inversion')
      expect(link.getAttribute('title')).toBe(detail)
      expect(link.textContent).toBe(formatPortalEUR(1000, language))
      expect(link.textContent).not.toContain(formatPortalEUR(1210, language))
      expect(screen.queryByText('Para empezar')).toBeNull()
      expect(screen.queryByText('Plazo estimado')).toBeNull()
      expect(screen.queryByText('Después')).toBeNull()
    },
  )

  it('shows the initial amount after line and global discounts, excluding recurring charges', () => {
    const totals = computeProposalTotals(
      [
        {
          quantity: 1,
          unit_price: 1000,
          vat_rate: 21,
          billing_cycle: 'none',
          discount_percent: 20,
        },
        { quantity: 1, unit_price: 100, vat_rate: 21, billing_cycle: 'monthly' },
      ],
      { type: 'percent', value: 10 },
    )
    render(<DecisionSummary {...baseProps} totals={totals} />)

    expect(
      screen.getByRole('link', { name: /Ver desglose de la inversión/ }).textContent,
    ).toContain(formatPortalEUR(720, 'es'))
  })

  it('does not invent a deposit, timeline or recurring cost when they are absent', () => {
    render(<DecisionSummary {...baseProps} totals={computeProposalTotals([])} canRespond={false} />)

    expect(screen.getByText('Inversión')).toBeDefined()
    expect(
      screen.getByRole('link', { name: /Ver desglose de la inversión/ }).textContent,
    ).toContain(formatPortalEUR(0, 'es'))
    expect(screen.queryByText('Para empezar')).toBeNull()
    expect(screen.queryByText('Plazo estimado')).toBeNull()
    expect(screen.queryByText('Después')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('still sends the review action to the visible acceptance panel', () => {
    vi.useFakeTimers()
    const scrollIntoView = vi.fn()
    try {
      render(
        <>
          <DecisionSummary {...baseProps} />
          <div data-proposal-response>
            <button type="button">Aceptar propuesta</button>
          </div>
        </>,
      )
      const accept = screen.getByRole('button', { name: 'Aceptar propuesta' })
      const panel = accept.parentElement!
      const rect = new DOMRect(0, 0, 100, 100)
      vi.spyOn(panel, 'getClientRects').mockReturnValue(
        Object.assign([rect], { item: (index: number) => (index === 0 ? rect : null) }),
      )
      Object.defineProperty(panel, 'scrollIntoView', { value: scrollIntoView })

      fireEvent.click(screen.getByRole('button', { name: 'Revisar y aceptar' }))
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
      vi.runAllTimers()
      expect(document.activeElement).toBe(accept)
    } finally {
      vi.useRealTimers()
    }
  })
})
