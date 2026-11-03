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

import { CallWorkspace } from './call-workspace'
import { getLeadCallBriefing } from './call-workspace-actions'
import { LeadAssistantConversation } from './lead-assistant'

vi.mock('./call-workspace-actions', () => ({ getLeadCallBriefing: vi.fn() }))
vi.mock('@/lib/supabase/browser', () => ({
  getBrowserClient: () => ({
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }) },
  }),
}))
vi.mock('@doscientos/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@doscientos/ui')>()),
  Drawer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DrawerTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DrawerDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}))

const context = {
  ok: true as const,
  aiEnabled: true,
  briefing: {
    name: 'Synthetic lead',
    company: 'Synthetic company',
    leadStatus: 'qualified',
    estimatedValue: 4000,
    summary: 'Necesita automatizar las reservas.',
    summaryOrigin: 'ai' as const,
    questions: [
      {
        question: '¿Quién confirma el alcance?',
        status: 'open',
        rationale: 'Aclarar quién participa en la aprobación.',
      },
    ],
    proposals: [{ title: 'Reservas', status: 'sent', total: 3000 }],
    invoiceCount: null,
    paidTotal: null,
    outstandingTotal: null,
  },
}
const props = {
  leadId: 'synthetic',
  phone: '600000000',
  status: 'dialing',
  pending: false,
  error: null,
  qr: null,
  qrError: false,
  completion: null,
  onOpenChange: vi.fn(),
  onCall: vi.fn(),
  onFinish: vi.fn(),
  onRegister: vi.fn(),
}

function render(workspace: ReactNode) {
  return renderComponent(workspace, {
    wrapper: ({ children }) => (
      <AssistantSessionProvider user={{ id: 'synthetic-user', role: 'member', accessScope: 'all' }}>
        {children}
      </AssistantSessionProvider>
    ),
  })
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(getLeadCallBriefing).mockResolvedValue(context)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('during-call workspace', () => {
  it('keeps the briefing and assistant input when switching tabs without AI requests', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const { rerender } = render(<CallWorkspace {...props} />)
    await screen.findByText('Necesita automatizar las reservas.')
    expect(screen.getByText('¿Quién confirma el alcance?')).toBeTruthy()
    expect(screen.getByText('Aclarar quién participa en la aprobación.')).toBeTruthy()
    expect(screen.getByText('Contexto comercial')).toBeTruthy()

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Asistente' }), { button: 0 })
    const input = screen.getByLabelText('Pregunta sobre el lead') as HTMLTextAreaElement
    fireEvent.click(screen.getByRole('button', { name: /Cómo abrir la llamada/ }))
    expect(input.value).toContain('Estoy en una llamada')
    fireEvent.change(input, { target: { value: 'Me pregunta por el plazo, ¿qué le digo?' } })
    expect(screen.getByText('Necesita automatizar las reservas.')).toBeTruthy()
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Preguntas' }), { button: 0 })
    expect(screen.getByRole('tabpanel', { name: 'Preguntas' })).toBeTruthy()
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Asistente' }), { button: 0 })
    expect(input.value).toBe('Me pregunta por el plazo, ¿qué le digo?')
    expect(fetch).not.toHaveBeenCalled()
    expect(getLeadCallBriefing).toHaveBeenCalledTimes(1)
    rerender(<LeadAssistantConversation leadId={props.leadId} />)
    expect((screen.getByLabelText('Pregunta sobre el lead') as HTMLTextAreaElement).value).toBe(
      'Me pregunta por el plazo, ¿qué le digo?',
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it('preserves call controls and only offers registration after finishing', async () => {
    const { rerender } = render(<CallWorkspace {...props} />)
    await screen.findByText('Synthetic lead')
    fireEvent.click(screen.getByRole('button', { name: 'Terminar' }))
    expect(props.onFinish).toHaveBeenCalledOnce()
    rerender(
      <CallWorkspace
        {...props}
        status="awaiting_log"
        completion={{ durationMinutes: 3, defaultOutcome: 'connected' }}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Llamar aquí' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar resultado' }))
    expect(props.onRegister).toHaveBeenCalledOnce()
    rerender(<CallWorkspace {...props} status="logged" />)
    expect(screen.getByText('Resultado ya registrado')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Registrar resultado' })).toBeNull()
  })

  it('keeps mobile handoff available on context failure and retries only explicitly', async () => {
    vi.mocked(getLeadCallBriefing).mockResolvedValueOnce({
      ok: false,
      error: 'Contexto no disponible.',
    })
    render(<CallWorkspace {...props} qrError />)
    await screen.findByText('Contexto no disponible.')
    expect(screen.getByRole('tab', { name: 'Asistente' }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByText('Llamar desde el móvil'))
    expect(screen.getByText(/No se pudo generar el QR/)).toBeTruthy()
    expect(getLeadCallBriefing).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar contexto' }))
    await screen.findByText('Synthetic lead')
    expect(getLeadCallBriefing).toHaveBeenCalledTimes(2)
  })

  it('shows an honest general guide when there are no prepared questions or AI', async () => {
    vi.mocked(getLeadCallBriefing).mockResolvedValue({
      ...context,
      aiEnabled: false,
      briefing: { ...context.briefing, questions: [] },
    })
    render(<CallWorkspace {...props} pending />)
    await screen.findByText('Synthetic lead')
    await waitFor(() => expect(screen.getByText('Guía general para la llamada')).toBeTruthy())
    expect(screen.getByText(/Estas preguntas son generales/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Terminar' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('tab', { name: 'Asistente' }).hasAttribute('disabled')).toBe(true)
  })
})
