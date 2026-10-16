import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { listLeads, listActiveMembers } = vi.hoisted(() => ({
  listLeads: vi.fn(),
  listActiveMembers: vi.fn(),
}))

vi.mock('@/lib/leads/queries', () => ({ listLeads }))
vi.mock('@/lib/auth', () => ({
  requireUser: async () => ({ id: 'member-1', name: 'Ana', role: 'viewer' }),
}))
vi.mock('@/lib/members/queries', () => ({ listActiveMembers }))
vi.mock('@/lib/env', () => ({ isAIEnabled: () => false, isGoogleEnabled: () => false }))
vi.mock('@/components/layout/list-controls', () => ({ ListControls: () => null }))
vi.mock('@/components/layout/page-header', () => ({ PageHeader: () => null }))
vi.mock('@/components/ui/button', () => ({ Button: () => null }))
vi.mock('./lead-create-dialog', () => ({ LeadCreateDialog: () => null }))
vi.mock('./leads-kanban', () => ({ LeadsKanban: () => null }))
vi.mock('./leads-list', () => ({ LeadsList: () => null }))
vi.mock('./view-toggle', () => ({ LeadsViewToggle: () => null }))
vi.mock('./lead-form-fields', () => ({
  LEAD_SOURCES: ['Landing'],
  SOLUTION_TYPES: ['Software'],
}))

import { ListControls } from '@/components/layout/list-controls'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyTitle } from '@/components/ui/empty-state'
import { LEAD_BOARD_LIMIT } from '@/lib/leads/types'
import type { MemberOption } from '@/lib/members/queries'

import { LeadCreateDialog } from './lead-create-dialog'
import LeadsPage from './page'

type Props = {
  actions?: ReactNode
  children?: ReactNode
  description?: string
  href?: string
  trigger?: ReactNode
  columns?: { key: string; label: string }[]
  filters?: { key: string }[]
}

function elements(node: ReactNode): ReactElement<Props>[] {
  const found: ReactElement<Props>[] = []
  Children.forEach(node, (child) => {
    if (isValidElement<Props>(child)) {
      found.push(child, ...elements(child.props.children))
    }
  })
  return found
}

describe('leads search experience', () => {
  beforeEach(() => {
    listLeads.mockReset().mockResolvedValue({ leads: [], count: 0, error: null })
    listActiveMembers.mockReset().mockResolvedValue([])
  })

  it('starts the leads query without waiting for the owner options when no owner is selected', async () => {
    let resolveMembers!: (members: MemberOption[]) => void
    listActiveMembers.mockReturnValueOnce(
      new Promise<MemberOption[]>((resolve) => {
        resolveMembers = resolve
      }),
    )

    const page = LeadsPage({ searchParams: Promise.resolve({}) })
    try {
      await vi.waitFor(() => expect(listLeads).toHaveBeenCalledTimes(1))
      expect(listLeads).toHaveBeenCalledWith(expect.objectContaining({ assignee: null }))
    } finally {
      resolveMembers([])
    }
    await page
  })

  it.each([
    ['member-1', 'member-1'],
    ['unknown-member', null],
  ])('still validates the requested owner %s before querying', async (requested, expected) => {
    listActiveMembers.mockResolvedValue([
      { id: 'member-1', name: 'Ana', avatar_url: null, github_handle: null },
    ])
    await LeadsPage({ searchParams: Promise.resolve({ assignee: requested }) })
    expect(listLeads).toHaveBeenCalledWith(expect.objectContaining({ assignee: expected }))
  })

  it.each([{ q: '671 171 525' }, { status: 'new' }, { source: 'Landing' }])(
    'distinguishes an empty search from an empty CRM: %j',
    async (searchParams) => {
      const page = await LeadsPage({ searchParams: Promise.resolve(searchParams) })
      const nodes = elements(page)

      expect(nodes.find((node) => node.type === EmptyTitle)?.props.children).toBe(
        'No hay resultados con esta búsqueda y filtros',
      )
      expect(nodes.find((node) => node.type === 'output')?.props.children).toBe(
        '0 leads encontrados',
      )
      expect(nodes.find((node) => node.props.href === '/leads')?.props.children).toBe(
        'Limpiar búsqueda y filtros',
      )
    },
  )

  it('keeps the initial empty state when there is no search or filter', async () => {
    const page = await LeadsPage({ searchParams: Promise.resolve({}) })
    expect(elements(page).find((node) => node.type === EmptyTitle)?.props.children).toBe(
      'Aún no hay leads.',
    )
  })

  it('makes a status filter visible in board view instead of silently retaining it', async () => {
    const page = await LeadsPage({ searchParams: Promise.resolve({ status: 'new' }) })
    const controls = elements(page).find((node) => node.type === ListControls)
    expect(controls?.props.filters).toContainEqual(expect.objectContaining({ key: 'status' }))
  })

  it('keeps the leads header compact and gives the mobile create action a label', async () => {
    listLeads.mockResolvedValue({ leads: [{ id: 'lead-1' }], count: 1, error: null })
    const boardPage = await LeadsPage({ searchParams: Promise.resolve({}) })
    const header = elements(boardPage).find((node) => node.type === PageHeader)

    expect(header?.props.description).toBeUndefined()
    const dialog = elements(header?.props.actions).find((node) => node.type === LeadCreateDialog)
    const trigger = dialog?.props.trigger as ReactElement<Props> | undefined
    const labels = elements(trigger?.props.children).map((node) => node.props.children)
    expect(labels).toContain('Nuevo')
    expect(labels).toContain('Nuevo lead')

    const listPage = await LeadsPage({ searchParams: Promise.resolve({ view: 'list' }) })
    expect((listPage.props as Props).description).toBeUndefined()
  })

  it('includes the phone in list results and preserves the complete search query', async () => {
    const page = await LeadsPage({
      searchParams: Promise.resolve({ view: 'list', q: '  +34 671 171 525  ' }),
    })
    expect((page.props as Props).columns).toContainEqual({ key: 'telefono', label: 'Teléfono' })
    expect((page.props as Props).columns).toContainEqual({
      key: 'proxima_accion',
      label: 'Próxima acción',
    })
    expect(listLeads).toHaveBeenCalledWith(expect.objectContaining({ q: '+34 671 171 525' }))
  })

  it.each([LEAD_BOARD_LIMIT, LEAD_BOARD_LIMIT + 1])(
    'only warns about truncated results when the total exceeds the board limit: %s',
    async (count) => {
      listLeads.mockResolvedValue({ leads: [{ id: 'lead-1' }], count, error: null })
      const page = await LeadsPage({ searchParams: Promise.resolve({ q: 'acme' }) })
      const warning = elements(page).some((node) =>
        Children.toArray(node.props.children).includes('Se muestran los primeros '),
      )
      expect(warning).toBe(count > LEAD_BOARD_LIMIT)
    },
  )
})
