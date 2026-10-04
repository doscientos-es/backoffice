import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProposalPriceBreakdown } from './proposal-price-breakdown'

describe('ProposalPriceBreakdown', () => {
  it('emphasizes the pre-VAT fee while showing applicable VAT and the estimated final total', () => {
    render(
      <ProposalPriceBreakdown
        title="Inversión inicial"
        subtotal={3000}
        taxAmount={630}
        total={3630}
        language="es"
      />,
    )

    expect(screen.getByText('Importe antes de IVA')).toBeDefined()
    expect(screen.getByText('IVA aplicable')).toBeDefined()
    expect(screen.getByText('Total previsto con IVA')).toBeDefined()
    expect(screen.getByText('Importe antes de IVA').previousElementSibling?.textContent).toMatch(
      /^3000,00/,
    )
    expect(screen.getByText('IVA aplicable').nextElementSibling?.textContent).toMatch(/^630,00/)
    expect(screen.getByText('Total previsto con IVA').nextElementSibling?.textContent).toMatch(
      /^3630,00/,
    )
  })
})
