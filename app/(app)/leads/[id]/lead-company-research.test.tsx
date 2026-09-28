import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LeadCompanyResearch } from './lead-company-research'

describe('LeadCompanyResearch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not offer research when its optional schema is unavailable', () => {
    render(
      <LeadCompanyResearch
        leadId="00000000-0000-4000-8000-000000000001"
        email="contact@acme.test"
        canEdit
        aiEnabled
        available={false}
        initialResearch={null}
        initialResearchedAt={null}
      />,
    )

    expect(screen.getByText(/estará disponible cuando termine de actualizarse/i)).toBeDefined()
    expect(screen.queryByRole('button', { name: /investigar empresa/i })).toBeNull()
  })

  it('offers research once its schema is available', () => {
    render(
      <LeadCompanyResearch
        leadId="00000000-0000-4000-8000-000000000001"
        email="contact@acme.test"
        canEdit
        aiEnabled
        available
        initialResearch={null}
        initialResearchedAt={null}
      />,
    )

    expect(screen.getByRole('button', { name: /investigar empresa/i })).toBeDefined()
    expect(screen.queryByText(/estará disponible cuando termine de actualizarse/i)).toBeNull()
  })

  it('shows a failed progress step instead of marking every step complete', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            [
              'event: progress\ndata: {"label":"Contrastando señales comerciales"}\n\n',
              'event: error\ndata: {"error":"No se pudo acceder al modelo."}\n\n',
            ].join(''),
            { status: 200 },
          ),
        ),
    )

    render(
      <LeadCompanyResearch
        leadId="00000000-0000-4000-8000-000000000001"
        email="contact@acme.test"
        canEdit
        aiEnabled
        available
        initialResearch={null}
        initialResearchedAt={null}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /investigar empresa/i }))

    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudo acceder al modelo.',
    )
    expect(screen.getByText('Falló')).toBeDefined()
  })
})
