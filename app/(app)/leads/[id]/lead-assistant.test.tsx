import {
  cleanup,
  fireEvent,
  render as renderComponent,
  screen,
  waitFor,
} from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AssistantSessionProvider } from '@/components/leads/assistant-session-provider'
import { assistantStorageKey } from '@/lib/leads/assistant-storage'

vi.mock('@/lib/supabase/browser', () => ({
  getBrowserClient: () => ({
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }) },
  }),
}))

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

const USER = { id: 'synthetic-user', role: 'member', accessScope: 'all' } as const
function render(assistant: ReactNode) {
  return renderComponent(assistant, {
    wrapper: ({ children }) => (
      <AssistantSessionProvider user={USER}>{children}</AssistantSessionProvider>
    ),
  })
}

describe('lead assistant panel', () => {
  beforeEach(() => {
    localStorage.clear()
  })
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
    const panel = render(<LeadAssistant leadId="synthetic" />)
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

    fireEvent.change(screen.getByLabelText('Pregunta sobre el lead'), {
      target: { value: 'Pregunta sin enviar' },
    })
    const key = assistantStorageKey(
      { userId: USER.id, permissions: 'member:all:true:false' },
      'synthetic',
    )
    const saved = localStorage.getItem(key)
    panel.unmount()
    render(<LeadAssistant leadId="synthetic" />)
    expect(screen.getByText('Borrador preparado.')).toBeTruthy()
    expect((screen.getByLabelText('Título del borrador') as HTMLInputElement).value).toBe(
      'Asunto revisado',
    )
    expect((screen.getByLabelText('Texto del borrador') as HTMLTextAreaElement).value).toBe(
      'Texto revisado',
    )
    expect((screen.getByLabelText('Pregunta sobre el lead') as HTMLTextAreaElement).value).toBe(
      'Pregunta sin enviar',
    )
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(key)).toBe(saved)

    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    const history = JSON.parse(fetch.mock.calls[1]![1].body).history
    expect(history).toEqual([
      { role: 'user', content: 'Prepara un email' },
      {
        role: 'assistant',
        content: '## Resumen\n\n**Borrador preparado.**\nBorrador: Asunto revisado\nTexto revisado',
      },
    ])
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
    expect(screen.getByRole('log').textContent).not.toContain('¿Qué falta?')
  })

  it('isolates leads and restores the unfinished question when returning to a lead', () => {
    const panel = render(<LeadAssistant leadId="lead-one" />)
    fireEvent.change(screen.getByLabelText('Pregunta sobre el lead'), {
      target: { value: 'Solo lead uno' },
    })
    panel.rerender(<LeadAssistant leadId="lead-two" />)
    expect((screen.getByLabelText('Pregunta sobre el lead') as HTMLTextAreaElement).value).toBe('')
    fireEvent.change(screen.getByLabelText('Pregunta sobre el lead'), {
      target: { value: 'Solo lead dos' },
    })
    panel.rerender(<LeadAssistant leadId="lead-one" />)
    expect((screen.getByLabelText('Pregunta sobre el lead') as HTMLTextAreaElement).value).toBe(
      'Solo lead uno',
    )
  })

  it('clears saved history and ignores an answer arriving after starting a new conversation', async () => {
    let resolveResponse!: (response: Response) => void
    const fetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve
        }),
    )
    vi.stubGlobal('fetch', fetch)
    render(<LeadAssistant leadId="synthetic" />)
    fireEvent.change(screen.getByLabelText('Pregunta sobre el lead'), {
      target: { value: 'Consulta anterior' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }))
    const signal = fetch.mock.calls[0]![1].signal as AbortSignal
    fireEvent.click(screen.getByRole('button', { name: 'Nueva conversación' }))
    expect(signal.aborted).toBe(true)
    expect(screen.queryByText('Consulta anterior')).toBeNull()
    expect(localStorage.length).toBe(0)
    resolveResponse(
      new Response(
        JSON.stringify({
          answer: 'Respuesta obsoleta',
          sources: [],
          sourceIds: [],
          draft: null,
          coverage: 'Partial',
        }),
      ),
    )
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
    expect(screen.queryByText('Respuesta obsoleta')).toBeNull()
    expect(localStorage.length).toBe(0)
  })

  it('keeps working and explains when local storage is blocked', () => {
    const storage = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })
    try {
      render(<LeadAssistant leadId="synthetic" />)
      fireEvent.change(screen.getByLabelText('Pregunta sobre el lead'), {
        target: { value: 'Pregunta en memoria' },
      })
      expect(screen.getByText(/No se puede guardar en este navegador/)).toBeTruthy()
      expect((screen.getByLabelText('Pregunta sobre el lead') as HTMLTextAreaElement).value).toBe(
        'Pregunta en memoria',
      )
      expect(
        (screen.getByRole('button', { name: 'Consultar' }) as HTMLButtonElement).disabled,
      ).toBe(false)
    } finally {
      storage.mockRestore()
    }
  })
})
