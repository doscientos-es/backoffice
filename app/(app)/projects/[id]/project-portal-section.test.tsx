import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const actions = vi.hoisted(() => ({
  previewProjectPortalEmail: vi.fn(),
  publishProjectPortal: vi.fn(),
  sendProjectPortalEmail: vi.fn(),
  updateProjectPortalAccess: vi.fn(),
}))

vi.mock('../actions', () => actions)
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@doscientos/ui', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))
vi.mock('@/components/portal/copy-portal-link', () => ({ CopyPortalLink: () => null }))
vi.mock('@/components/portal/portal-access-controls', () => ({ PortalAccessControls: () => null }))
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
}))
vi.mock('@/components/ui/form-feedback', () => ({
  FormFeedback: () => null,
  useFormFeedback: () => ({
    state: { status: 'idle' },
    pending: false,
    setError: vi.fn(),
    setPending: vi.fn(),
    setSuccess: vi.fn(),
  }),
}))
vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))
vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}))
vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}))

import { ProjectPortalSection } from './project-portal-section'

const props = {
  projectId: '00000000-0000-0000-0000-000000000001',
  projectName: 'Portal de clientes',
  portalToken: 'portal-token',
  hasPassword: false,
  inviteSentAt: null,
  clientEmail: 'cliente@example.test',
  clientPhone: '+34 600 123 456',
  canEdit: true,
  canPublish: true,
}

describe('ProjectPortalSection', () => {
  beforeEach(() => {
    actions.publishProjectPortal.mockReset().mockResolvedValue({ ok: true })
    actions.previewProjectPortalEmail.mockReset().mockResolvedValue({
      ok: true,
      subject: 'Arrancamos con Portal de clientes',
      html: '<p>Arrancamos</p>',
      clientEmail: 'cliente@example.test',
      clientPhone: '+34 600 123 456',
      clientName: 'María López',
      projectName: 'Portal de clientes',
      portalUrl: 'https://app.example.test/p/project/token',
    })
    actions.sendProjectPortalEmail.mockReset().mockResolvedValue({ ok: true, mocked: false })
  })

  it('makes activation prominent and publishes the portal from the CTA', async () => {
    render(<ProjectPortalSection {...props} visible={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Activar y avisar al cliente' }))

    await waitFor(() =>
      expect(actions.publishProjectPortal).toHaveBeenCalledWith({ id: props.projectId }),
    )
  })

  it('prepares the portal link in WhatsApp from the quick-send dialog', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<ProjectPortalSection {...props} visible />)

    fireEvent.click(screen.getByRole('button', { name: 'Enviar acceso' }))
    await waitFor(() => expect(actions.previewProjectPortalEmail).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Compartir por WhatsApp' }))

    const url = new URL(open.mock.calls[0]?.[0] as string)
    expect(url.pathname).toBe('/34600123456')
    expect(url.searchParams.get('text')).toContain('ya hemos empezado con Portal de clientes.')
    expect(url.searchParams.get('text')).toContain('https://app.example.test/p/project/token')
    open.mockRestore()
  })

  it('sends the prepared kickoff email to the prefilled client address', async () => {
    render(<ProjectPortalSection {...props} visible />)

    fireEvent.click(screen.getByRole('button', { name: 'Enviar acceso' }))
    await waitFor(() => expect(actions.previewProjectPortalEmail).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Enviar email' }))

    await waitFor(() =>
      expect(actions.sendProjectPortalEmail).toHaveBeenCalledWith({
        id: props.projectId,
        to: 'cliente@example.test',
        message: undefined,
      }),
    )
  })
})
