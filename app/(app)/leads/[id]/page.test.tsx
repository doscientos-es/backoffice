import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { DetailRow } from '@/components/layout/detail-grid'
import { StatusBadge } from '@/components/ui/status-badge'

const { getLeadDetail, requireUser } = vi.hoisted(() => ({
  getLeadDetail: vi.fn(),
  requireUser: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ requireUser }))
vi.mock('@/lib/leads/queries', () => ({ getLeadDetail }))
vi.mock('@/lib/leads/ai-context', () => ({ formatLeadBriefingForAI: () => '' }))
vi.mock('@/lib/ai', () => ({ isAIEnabled: () => false }))

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
      linkedClientId: null,
      linkedClientName: null,
      proposals: [],
      projects: [],
      invoices: [],
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
  })
})
