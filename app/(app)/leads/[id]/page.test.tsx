import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { DetailRow } from '@/components/layout/detail-grid'
import { LeadClientAttachmentsSection } from '@/components/ui/lead-client-attachments-section'
import { StatusBadge } from '@/components/ui/status-badge'

import { LeadBillingPanel } from './lead-billing-panel'
import { LeadDeleteDangerZone } from './lead-delete-danger-zone'
import { LeadTabPanel } from './lead-detail-tabs'

const { getClientBillingDetail, getLeadDetail, requireUser } = vi.hoisted(() => ({
  getClientBillingDetail: vi.fn(),
  getLeadDetail: vi.fn(),
  requireUser: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ requireUser }))
vi.mock('@/lib/clients/queries', () => ({ getClientBillingDetail }))
vi.mock('@/lib/leads/queries', () => ({ getLeadDetail }))
vi.mock('@/lib/leads/ai-context', () => ({ formatLeadBriefingForAI: () => '' }))
vi.mock('@/lib/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/env')>()),
  isAIEnabled: () => false,
}))

import LeadDetailPage from './page'

function elements(node: ReactNode): ReactElement<{ children?: ReactNode; label?: string }>[] {
  const found: ReactElement<{ children?: ReactNode; label?: string }>[] = []
  Children.forEach(node, (child) => {
    if (isValidElement<{ children?: ReactNode; label?: string }>(child)) {
      found.push(child, ...elements(child.props.children))
    }
  })
  return found
}

function rowsInSection(node: ReactNode, heading: string) {
  const section = elements(node).find(
    (element) =>
      element.type === 'section' &&
      Children.toArray(element.props.children).some(
        (child) =>
          isValidElement<{ children?: ReactNode }>(child) &&
          child.type === 'h3' &&
          child.props.children === heading,
      ),
  )
  expect(section).toBeDefined()
  return elements(section).filter((element) => element.type === DetailRow)
}

describe('LeadDetailPage', () => {
  it('connects the billing tab to the existing linked client', async () => {
    requireUser.mockResolvedValue({ id: 'member-1', role: 'viewer', accessScope: 'all' })
    getLeadDetail.mockResolvedValue({
      lead: { id: 'lead-1', name: 'María', status: 'new', created_at: '2026-09-22' },
      interactions: [],
      auditEvents: [],
      linkedClientId: 'client-1',
      linkedClientName: 'Ejemplo',
      proposals: [],
      projects: [],
      invoices: [],
      contacts: [],
      tasks: [],
      reminders: [],
      attachments: [],
      discoveryQuestions: [],
    })
    const client = { id: 'client-1', name: 'Ejemplo', logo_url: 'https://example.com/logo.png' }
    getClientBillingDetail.mockResolvedValue(client)

    const page = await LeadDetailPage({ params: Promise.resolve({ id: 'lead-1' }) })
    const panel = elements(page).find((element) => element.type === LeadBillingPanel)
    expect(getClientBillingDetail).toHaveBeenCalledWith('client-1')
    expect(panel?.props).toMatchObject({ leadId: 'lead-1', client, canEdit: false })
  })

  it('does not offer fiscal data for a user without full client scope', async () => {
    requireUser.mockResolvedValue({ id: 'member-1', role: 'sales', accessScope: 'assigned' })
    getLeadDetail.mockResolvedValue({
      lead: { id: 'lead-1', name: 'María', status: 'new', created_at: '2026-09-22' },
      interactions: [],
      auditEvents: [],
      linkedClientId: null,
      linkedClientName: null,
      proposals: [],
      projects: [],
      invoices: [],
      contacts: [],
      tasks: [],
      reminders: [],
      attachments: [],
      discoveryQuestions: [],
    })
    getClientBillingDetail.mockClear()
    const page = await LeadDetailPage({ params: Promise.resolve({ id: 'lead-1' }) })
    const panel = elements(page).find((element) => element.type === LeadBillingPanel)
    expect(panel?.props).toMatchObject({ canRead: false, canEdit: false })
    expect(getClientBillingDetail).not.toHaveBeenCalled()
  })

  it('shows the full name in Contacto and the status only in Oportunidad', async () => {
    requireUser.mockResolvedValue({ id: 'member-1', name: 'Ana', role: 'viewer' })
    getLeadDetail.mockResolvedValue({
      lead: {
        id: 'lead-1',
        name: 'María García',
        alias: 'María',
        status: 'new',
        created_at: '2026-09-22',
      },
      interactions: [],
      auditEvents: [],
      linkedClientId: null,
      linkedClientName: null,
      proposals: [],
      projects: [],
      invoices: [],
      contacts: [],
      tasks: [],
      reminders: [],
      attachments: [],
      discoveryQuestions: [],
    })

    const page = await LeadDetailPage({ params: Promise.resolve({ id: 'lead-1' }) })
    const contact = rowsInSection(page, 'Contacto')
    const opportunity = rowsInSection(page, 'Oportunidad')

    expect(contact.find((row) => row.props.label === 'Alias')?.props.children).toBe('María')
    expect(contact.find((row) => row.props.label === 'Nombre')?.props.children).toBe('María García')
    expect(contact.some((row) => row.props.label === 'Estado')).toBe(false)
    const status = opportunity.find((row) => row.props.label === 'Estado')
    expect(isValidElement(status?.props.children)).toBe(true)
    if (isValidElement<{ value: string }>(status?.props.children)) {
      expect(status.props.children.type).toBe(StatusBadge)
      expect(status.props.children.props.value).toBe('new')
    }
    expect(elements(page).some((element) => element.type === LeadDeleteDangerZone)).toBe(false)
    const summary = elements(page).find(
      (element) =>
        element.type === LeadTabPanel && (element.props as { tab?: string }).tab === 'resumen',
    )
    const attachments = elements(summary).find(
      (element) => element.type === LeadClientAttachmentsSection,
    )
    expect(attachments?.props).toMatchObject({
      leadId: 'lead-1',
      clientId: null,
      entityType: 'lead',
      canEdit: false,
    })
  })

  it.each(['owner', 'admin'])('shows the delete danger zone to %s users', async (role) => {
    requireUser.mockResolvedValue({ id: 'admin-1', name: 'Ana', role })
    getLeadDetail.mockResolvedValue({
      lead: {
        id: 'lead-1',
        name: 'María García',
        status: 'new',
        created_at: '2026-09-22',
      },
      interactions: [],
      auditEvents: [],
      linkedClientId: null,
      linkedClientName: null,
      proposals: [],
      projects: [],
      invoices: [],
      contacts: [],
      tasks: [],
      reminders: [],
      attachments: [],
      discoveryQuestions: [],
    })

    const page = await LeadDetailPage({ params: Promise.resolve({ id: 'lead-1' }) })

    expect(elements(page).some((element) => element.type === LeadDeleteDangerZone)).toBe(true)
  })
})
