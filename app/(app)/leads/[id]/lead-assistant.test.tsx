import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@doscientos/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@doscientos/ui')>()),
  Drawer: ({ trigger, children }: { trigger: ReactNode; children: ReactNode }) => (
    <div>
      {trigger}
      {children}
    </div>
  ),
  DrawerHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DrawerTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DrawerDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}))
vi.mock('@/components/ui/copy-button', () => ({
  CopyButton: ({ text }: { text: string }) => (
    <button type="button" data-copy-text={text}>
      Copiar borrador
    </button>
  ),
}))

import { LeadAssistant } from './lead-assistant'

describe('lead assistant panel', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('waits for explicit submission, shows citations and keeps drafts editable without any send operation', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          answer: 'Borrador preparado.',
          sourceIds: ['lead:synthetic'],
          coverage: 'Partial',
          sources: [
            {
              id: 'lead:synthetic',
              label: 'Ficha del lead',
              href: '/leads/synthetic',
              createdAt: null,
            },
          ],
          draft: {
            kind: 'email',
            title: 'Retomamos el contacto',
            body: 'Hola, revisamos el alcance acordado.',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetch)
    render(<LeadAssistant leadId="synthetic" />)
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Pregunta sobre el lead'), {
      target: { value: 'Prepara un email' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar', exact: true }))
    await screen.findByText('Borrador preparado.')
    expect(screen.getByRole('link', { name: 'Ficha del lead' }).getAttribute('href')).toBe(
      '/leads/synthetic',
    )
    fireEvent.change(screen.getByLabelText('Texto del borrador'), {
      target: { value: 'Texto revisado' },
    })
    expect(
      screen.getByRole('button', { name: 'Copiar borrador' }).getAttribute('data-copy-text'),
    ).toContain('Texto revisado')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0]![0]).toBe('/api/crm/ai/lead-assistant')
    expect(screen.queryByRole('button', { name: /enviar/i })).toBeNull()
  })

  it('preserves the question after a failed request and does not retry automatically', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('Synthetic network error'))
    vi.stubGlobal('fetch', fetch)
    render(<LeadAssistant leadId="synthetic" />)
    fireEvent.change(screen.getByLabelText('Pregunta sobre el lead'), {
      target: { value: '¿Qué falta?' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar', exact: true }))
    await screen.findByRole('alert')
    await waitFor(() =>
      expect((screen.getByLabelText('Pregunta sobre el lead') as HTMLTextAreaElement).value).toBe(
        '¿Qué falta?',
      ),
    )
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
