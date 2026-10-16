/* oxlint-disable react/forbid-elements -- Native buttons intentionally isolate list/drawer test doubles. */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ deleteClient: vi.fn(), deleteProject: vi.fn() }))
vi.mock('@/app/(app)/clients/actions', () => ({ deleteClient: mocks.deleteClient }))
vi.mock('@/app/(app)/projects/actions', () => ({ deleteProject: mocks.deleteProject }))
vi.mock('@/components/layout/list-page', () => ({
  ListPage: ({
    rows,
    onRowClick,
  }: {
    rows: Array<{ id: string; data?: { name: string } }>
    onRowClick: (row: unknown) => void
  }) => (
    <div>
      {rows.map((row) => (
        <button key={row.id} type="button" onClick={() => onRowClick(row)}>
          {row.data?.name}
        </button>
      ))}
    </div>
  ),
}))

type DrawerProps = {
  canEdit: boolean
  onCloseAction: () => void
  onDeleteAction: (id: string) => void
}
function Drawer({
  item,
  canEdit,
  onCloseAction,
  onDeleteAction,
}: DrawerProps & { item: { id: string } | null }) {
  if (!item) return null
  return (
    <section aria-label="Quick view">
      <button type="button" onClick={onCloseAction}>
        Close
      </button>
      {canEdit ? (
        <button type="button" onClick={() => onDeleteAction(item.id)}>
          Delete
        </button>
      ) : null}
    </section>
  )
}
vi.mock('@/app/(app)/clients/client-quick-view', () => ({
  ClientQuickView: (props: DrawerProps & { client: { id: string } | null }) => (
    <Drawer {...props} item={props.client} />
  ),
}))
vi.mock('@/app/(app)/projects/project-quick-view', () => ({
  ProjectQuickView: (props: DrawerProps & { project: { id: string } | null }) => (
    <Drawer {...props} item={props.project} />
  ),
}))

import type { QuickClient } from '@/app/(app)/clients/client-quick-view'
import { ClientsList } from '@/app/(app)/clients/clients-list'
import type { QuickProject } from '@/app/(app)/projects/project-quick-view'
import { ProjectsList } from '@/app/(app)/projects/projects-list'
import type { ListPageProps } from '@/components/layout/list-page'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.deleteClient.mockResolvedValue({ ok: true })
  mocks.deleteProject.mockResolvedValue({ ok: true })
})
afterEach(cleanup)

const baseProps = { title: 'Test', empty: 'Empty', columns: [], rows: [] }
const client: QuickClient = {
  id: 'client-1',
  name: 'Test client',
  label: null,
  logo_url: null,
  email: null,
  phone: null,
  nif: null,
  contact_person: null,
  billing_address_street: null,
  billing_address_zip: null,
  billing_address_city: null,
  billing_address_province: null,
  billing_address_country: null,
  notes: null,
  updated_at: null,
  version: 1,
}
const project: QuickProject = {
  id: 'project-1',
  name: 'Test project',
  client_name: 'Test client',
  status: 'active',
  description: null,
  updated_at: null,
}
const cases = [
  {
    name: 'clients',
    title: client.name,
    id: client.id,
    remove: mocks.deleteClient,
    render: (canEdit: boolean, exists = true) => (
      <ClientsList
        {...(baseProps as ListPageProps<QuickClient>)}
        rows={exists ? [{ id: client.id, data: client, cells: {} }] : []}
        canEdit={canEdit}
      />
    ),
  },
  {
    name: 'projects',
    title: project.name,
    id: project.id,
    remove: mocks.deleteProject,
    render: (canEdit: boolean, exists = true) => (
      <ProjectsList
        {...(baseProps as ListPageProps<QuickProject>)}
        rows={exists ? [{ id: project.id, data: project, cells: {} }] : []}
        canEdit={canEdit}
      />
    ),
  },
]

describe.each(cases)('$name deferred quick view', (testCase) => {
  it('opens, closes and reopens while preserving read-only permissions', async () => {
    render(testCase.render(false))
    expect(screen.queryByRole('region', { name: 'Quick view' })).toBeNull()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: testCase.title }))
    })
    expect(await screen.findByRole('region', { name: 'Quick view' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('region', { name: 'Quick view' })).toBeNull()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: testCase.title }))
    })
    expect(await screen.findByRole('region', { name: 'Quick view' })).toBeDefined()
  })

  it('preserves optimistic deletion from the loaded drawer', async () => {
    let finish!: (value: { ok: true }) => void
    testCase.remove.mockReturnValueOnce(
      new Promise<{ ok: true }>((resolve) => {
        finish = resolve
      }),
    )
    const { rerender } = render(testCase.render(true))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: testCase.title }))
    })
    try {
      fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
      expect(testCase.remove).toHaveBeenCalledWith({ id: testCase.id })
      expect(screen.queryByRole('button', { name: testCase.title })).toBeNull()
      expect(screen.queryByRole('region', { name: 'Quick view' })).toBeNull()
      // Server revalidation supplies the updated list before the action settles.
      rerender(testCase.render(true, false))
    } finally {
      await act(async () => finish({ ok: true }))
    }
  })
})
