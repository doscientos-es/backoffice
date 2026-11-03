import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { computeProposalTotals } from '@/lib/finance'

import { makeTr } from '../_lib/i18n'
import { PricingSummary } from './pricing-summary'

afterEach(cleanup)

const props = {
  totals: computeProposalTotals([{ quantity: 1, unit_price: 1000, vat_rate: 21 }]),
  language: 'es' as const,
  tr: makeTr('es'),
  globalDiscountReason: null,
  paymentPlan: [
    { id: 'acceptance', title: 'Al aceptar', percentage: 50 },
    { id: 'delivery', title: 'A la entrega', percentage: 50 },
  ],
}

describe('PricingSummary', () => {
  it('shows the investment and payment schedule in separate stacked blocks', () => {
    const { container } = render(<PricingSummary {...props} />)
    const investment = screen.getByText('Inversión inicial')
    const schedule = screen.getByText('Cómo se paga')
    const blocks = container.firstElementChild!

    expect(blocks.classList.contains('flex-col')).toBe(true)
    expect(blocks.querySelector('[class*="flex-row"]')).toBeNull()
    expect(blocks.children[0]!.contains(investment)).toBe(true)
    expect(blocks.children[1]!.contains(schedule)).toBe(true)
    expect(within(blocks.children[0] as HTMLElement).getByText(/^1210,00/)).toBeDefined()
    expect(within(blocks.children[1] as HTMLElement).getAllByText(/^605,00/)).toHaveLength(2)
  })

  it('omits the payment schedule for a single installment', () => {
    render(<PricingSummary {...props} paymentPlan={props.paymentPlan.slice(0, 1)} />)
    expect(screen.getByText('Inversión inicial')).toBeDefined()
    expect(screen.queryByText('Cómo se paga')).toBeNull()
  })
})
