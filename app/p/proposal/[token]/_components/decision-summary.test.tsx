import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { computeProposalTotals } from '@/lib/finance'
import { formatPortalEUR } from '@/lib/portal/language'

import { makeTr } from '../_lib/i18n'
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
  depositAmount: 605,
  initialPaymentPercentage: 50,
  totalWeeks: 4,
  canRespond: true,
}

describe('DecisionSummary', () => {
  it('keeps investment, deposit, timeline and recurring charges distinct', () => {
    render(<DecisionSummary {...baseProps} />)

    const stat = (label: string) => within(screen.getByText(label).closest('div')!)
    expect(stat('Inversión').getByRole('definition').textContent).toContain(
      formatPortalEUR(1210, 'es'),
    )
    expect(stat('Para empezar').getByRole('definition').textContent).toContain(
      formatPortalEUR(605, 'es'),
    )
    expect(stat('Plazo estimado').getByText('hasta 4 sem.')).toBeDefined()
    expect(stat('Después').getByRole('definition').textContent).toContain(
      formatPortalEUR(121, 'es'),
    )
    expect(stat('Después').getByText('/mes')).toBeDefined()
    expect(stat('Inversión').getByText('IVA incluido')).toBeDefined()
  })

  it('does not invent a deposit, timeline or recurring cost when they are absent', () => {
    render(
      <DecisionSummary
        {...baseProps}
        totals={computeProposalTotals([])}
        depositAmount={null}
        initialPaymentPercentage={null}
        totalWeeks={null}
        canRespond={false}
      />,
    )

    expect(screen.getByText('Inversión')).toBeDefined()
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
