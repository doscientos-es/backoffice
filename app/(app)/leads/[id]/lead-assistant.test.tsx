import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  CopyButton: ({ text, label = 'Copiar' }: { text: string; label?: string }) => (
    <button type="button" data-copy-text={text}>
      {label}
    </button>
  ),
}))

import { LeadAssistant } from './lead-assistant'

describe('lead assistant panel', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('prefills a suggestion and focuses the composer without making an AI request', () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    render(<LeadAssistant leadId="synthetic" leadName="Synthetic Lead" />)

    expect(screen.getByText('Synthetic Lead')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Presupuesto y plazos/ }))

    const input = screen.getByLabelText('Pregunta sobre el lead') as HTMLTextAreaElement
    expect(input.value).toBe('¿Qué sabemos de su presupuesto y sus plazos?')
    expect(document.activeElement).toBe(input)
    expect(fetch).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Preparar una propuesta/ }))
    expect(input.value).toContain('alcance confirmado')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('waits for explicit submission, shows citations and keeps drafts editable without any send operation', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          answer: '## Resumen\n\n**Borrador preparado.**',
          sourceIds: ['lead:synthetic'],
          coverage: 'Partial',
          sources: [
            {
              id: 'lead:synthetic',
              label: 'Ficha del lead',
              href: '/leads/synthetic',
              createdAt: '2022-04-06T10:00:00Z',
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
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }))
    await screen.findByText('Borrador preparado.')
    expect(screen.getByRole('heading', { name: 'Resumen' })).toBeTruthy()
    const source = screen.getByRole('link', { name: 'Ficha del lead' })
    expect(source.getAttribute('href')).toBe('/leads/synthetic')
    expect(source.querySelector('time')?.getAttribute('datetime')).toBe('2022-04-06T10:00:00Z')
    expect(screen.getByRole('button', { name: 'Copiar respuesta' })).toBeTruthy()
    const scope = screen.getByText('Contexto parcial · ver alcance')
    const details = scope.closest('details') as HTMLDetailsElement
    expect(details.open).toBe(false)
    fireEvent.click(scope)
    expect(details.open).toBe(true)
    expect(screen.getByText('Partial')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Título del borrador'), {
      target: { value: 'Asunto revisado' },
    })
    fireEvent.change(screen.getByLabelText('Texto del borrador'), {
      target: { value: 'Texto revisado' },
    })
    expect(
      screen.getByRole('button', { name: 'Copiar borrador' }).getAttribute('data-copy-text'),
    ).toBe('Asunto revisado\n\nTexto revisado')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0]![0]).toBe('/api/crm/ai/lead-assistant')
    expect(screen.queryByRole('button', { name: /enviar/i })).toBeNull()
  })

  it.each([
    { shortcut: 'Ctrl', modifier: { ctrlKey: true } },
    { shortcut: 'Command', modifier: { metaKey: true } },
  ])('submits with $shortcut + Enter, but not plain Enter or composition', async ({ modifier }) => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          answer: 'Resumen de prueba.',
          sourceIds: [],
          sources: [],
          coverage: 'Contexto sintético limitado.',
          draft: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetch)
    render(<LeadAssistant leadId="synthetic" />)
    const input = screen.getByLabelText('Pregunta sobre el lead')
    fireEvent.change(input, { target: { value: '¿Qué quedó pendiente?' } })

    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(input, { key: 'Enter', ...modifier, isComposing: true })
    expect(fetch).not.toHaveBeenCalled()

    fireEvent.keyDown(input, { key: 'Enter', ...modifier })
    await screen.findByText('Resumen de prueba.')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Sin fuentes enlazadas/)).toBeTruthy()
  })

  it('preserves the question after a failed request and does not retry automatically', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('Synthetic network error'))
    vi.stubGlobal('fetch', fetch)
    render(<LeadAssistant leadId="synthetic" />)
    fireEvent.change(screen.getByLabelText('Pregunta sobre el lead'), {
      target: { value: '¿Qué falta?' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }))
    await screen.findByRole('alert')
    await waitFor(() =>
      expect((screen.getByLabelText('Pregunta sobre el lead') as HTMLTextAreaElement).value).toBe(
        '¿Qué falta?',
      ),
    )
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
