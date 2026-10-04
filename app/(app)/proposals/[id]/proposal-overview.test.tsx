import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProposalOverview } from './proposal-overview'

describe('ProposalOverview', () => {
  it('renders additional proposal context in the right sidebar', () => {
    render(
      <ProposalOverview
        subtotal={1000}
        taxAmount={210}
        total={1200}
        validUntil={null}
        paymentPlan={[]}
        paymentTerms={null}
        items={[]}
        scopeModules={[]}
        deliverables={null}
        acceptanceCriteria={null}
        notes={null}
        team={[]}
        sidebar={<div data-testid="proposal-sidebar">Consultas del cliente</div>}
      />,
    )

    const sidebar = screen.getByTestId('proposal-sidebar')
    expect(sidebar.parentElement?.className).toContain('flex')
    expect(sidebar.parentElement?.parentElement?.className).toContain('grid')
  })

  it('highlights the pre-tax investment and keeps VAT and the payable total explicit', () => {
    render(
      <ProposalOverview
        subtotal={3000}
        taxAmount={630}
        total={3630}
        validUntil={null}
        paymentPlan={[]}
        paymentTerms={null}
        items={[]}
        scopeModules={[]}
        deliverables={null}
        acceptanceCriteria={null}
        notes={null}
        team={[]}
      />,
    )

    expect(screen.getByText('Inversión inicial · antes de IVA')).toBeDefined()
    expect(screen.getByText('IVA aplicable')).toBeDefined()
    expect(screen.getByText('Total previsto con IVA')).toBeDefined()
    expect(
      screen.getByText('Inversión inicial · antes de IVA').nextElementSibling?.textContent,
    ).toMatch(/3000,00/)
    expect(screen.getByText('IVA aplicable').nextElementSibling?.textContent).toMatch(/^630,00/)
    expect(screen.getByText('Total previsto con IVA').nextElementSibling?.textContent).toMatch(
      /^3630,00/,
    )
  })
})
