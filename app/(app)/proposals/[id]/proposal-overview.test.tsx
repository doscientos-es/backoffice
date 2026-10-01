import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProposalOverview } from './proposal-overview'

describe('ProposalOverview', () => {
  it('renders additional proposal context in the right sidebar', () => {
    render(
      <ProposalOverview
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
})
