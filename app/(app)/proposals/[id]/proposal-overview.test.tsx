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
        contextMarkdown={null}
        problemSolutionPairs={[]}
        deliverables={null}
        acceptanceCriteria={null}
        notes={null}
        terms={null}
        changeManagementTerms={null}
        legalTerms={null}
        maintenanceOffer={null}
        maintenanceSelectedPlanId={null}
        proposalId="proposal-1"
        attachments={[]}
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
        contextMarkdown={null}
        problemSolutionPairs={[]}
        deliverables={null}
        acceptanceCriteria={null}
        notes={null}
        terms={null}
        changeManagementTerms={null}
        legalTerms={null}
        maintenanceOffer={null}
        maintenanceSelectedPlanId={null}
        proposalId="proposal-1"
        attachments={[]}
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

  it('shows the proposal narrative, maintenance options, contract terms, and attachments', () => {
    render(
      <ProposalOverview
        subtotal={1000}
        taxAmount={210}
        total={1210}
        validUntil={null}
        paymentPlan={[]}
        paymentTerms={null}
        items={[]}
        scopeModules={[]}
        contextMarkdown="El cliente necesita automatizar ventas."
        problemSolutionPairs={[
          {
            id: 'pair-1',
            problem: 'Carga manual',
            problemDescription: 'El equipo introduce los datos a mano.',
            solution: 'Automatización',
            solutionDescription: 'Conectaremos el CRM con la web.',
          },
        ]}
        deliverables={null}
        acceptanceCriteria={null}
        notes={null}
        terms="Licencias a cargo del cliente."
        changeManagementTerms="Los cambios se presupuestan aparte."
        legalTerms="Condiciones legales acordadas."
        maintenanceOffer={{
          enabled: true,
          heading: 'Mantenimiento web',
          intro: 'Cobertura para la web del cliente.',
          recommended_plan_id: 'growth',
          billing_cycle: 'monthly',
          plans: [
            {
              id: 'growth',
              name: 'Crecimiento',
              summary: 'Soporte y mejoras cada mes.',
              monthly_price: 100,
              vat_rate: 21,
              coverage: ['Backups y seguridad'],
              exclusions: ['Desarrollos de gran alcance'],
            },
          ],
        }}
        maintenanceSelectedPlanId="growth"
        proposalId="proposal-1"
        attachments={[
          {
            id: 'attachment-1',
            name: 'Informe final.pdf',
            mime_type: 'application/pdf',
            size_bytes: 1024,
            created_at: '2026-01-01T00:00:00.000Z',
            source: 'storage',
          },
        ]}
        team={[]}
      />,
    )

    expect(screen.getByText('El cliente necesita automatizar ventas.')).toBeDefined()
    expect(screen.getByText('Problema · Carga manual')).toBeDefined()
    expect(screen.getByText('Solución · Automatización')).toBeDefined()
    expect(screen.getByText('Licencias a cargo del cliente.')).toBeDefined()
    expect(screen.getByText('Los cambios se presupuestan aparte.')).toBeDefined()
    expect(screen.getByText('Anexo contractual')).toBeDefined()
    expect(screen.getByText('Backups y seguridad')).toBeDefined()
    expect(screen.getByText('Desarrollos de gran alcance')).toBeDefined()
    expect(screen.getByText('Seleccionado')).toBeDefined()
    expect(screen.getByText('Informe final.pdf')).toBeDefined()
  })
})
