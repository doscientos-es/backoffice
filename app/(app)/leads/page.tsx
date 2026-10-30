import { Button, IconButton } from '@doscientos/ui'
import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import { Suspense } from 'react'

import { ListControls } from '@/components/layout/list-controls'
import { PageHeader } from '@/components/layout/page-header'
import { requireUser } from '@/lib/auth'
import { isAIEnabled, isGoogleEnabled } from '@/lib/env'
import { SELECTABLE_LEAD_STATUSES } from '@/lib/leads/pipeline'
import { listLeads } from '@/lib/leads/queries'
import { LEAD_LIST_PAGE_SIZE, LEAD_SORT_COLUMNS, type LeadAttentionFilter } from '@/lib/leads/types'
import { listActiveMembers } from '@/lib/members/queries'
import { LEAD_STATUS, type LeadStatus } from '@/lib/status'
import { parseSortParam } from '@/lib/utils/search-params'

import { LeadCreateDialog } from './lead-create-dialog'
import { LEAD_SOURCES, SOLUTION_TYPES } from './lead-form-fields'
import { LeadsBoard } from './leads-board'
import { LeadsBoardSkeleton } from './leads-board-skeleton'
import { LeadsList } from './leads-list'
import { LeadsViewToggle } from './view-toggle'

export const metadata: Metadata = { title: 'Leads · doscientos' }
export const dynamic = 'force-dynamic'

/** `qualifying` is omitted: it is folded into `in_conversation` when filtering. */
const STATUS_FILTER_OPTIONS = SELECTABLE_LEAD_STATUSES.map((value) => ({
  value,
  label: LEAD_STATUS[value].label,
}))

const SOURCE_FILTER_OPTIONS = LEAD_SOURCES.map((s) => ({ value: s, label: s }))
const SOLUTION_FILTER_OPTIONS = SOLUTION_TYPES.map((s) => ({ value: s, label: s }))

const ATTENTION_FILTER_OPTIONS: { value: LeadAttentionFilter; label: string }[] = [
  { value: 'stale', label: 'Estancados' },
  { value: 'unassigned', label: 'Sin responsable' },
  { value: 'urgent', label: 'Urgencia inmediata' },
]

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string
    q?: string
    status?: string
    source?: string
    solution?: string
    assignee?: string
    attention?: string
    ids?: string
    page?: string
  }>
}) {
  const sp = await searchParams
  const view: 'board' | 'list' = sp.view === 'list' ? 'list' : 'board'
  const q = (sp.q ?? '').trim()
  const status = (LEAD_STATUS as Record<string, unknown>)[sp.status ?? '']
    ? (sp.status as LeadStatus)
    : null
  const source = (LEAD_SOURCES as readonly string[]).includes(sp.source ?? '')
    ? (sp.source as string)
    : null
  const solutionType = (SOLUTION_TYPES as readonly string[]).includes(sp.solution ?? '')
    ? (sp.solution as string)
    : null
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1)
  const leadIds = [
    ...new Set((sp.ids ?? '').split(',').filter((id) => UUID_PATTERN.test(id))),
  ].slice(0, 25)
  const { sort, dir } = parseSortParam(sp, LEAD_SORT_COLUMNS, 'created_at', 'desc')

  const user = await requireUser()
  const aiEnabled = isAIEnabled()
  const googleEnabled = isGoogleEnabled()
  const canEdit = user.role !== 'viewer'

  const membersPromise = listActiveMembers()
  // Only a selected owner needs the members query before the leads query.
  let assignee: string | null = null
  if (sp.assignee) {
    const members = await membersPromise
    if (members.some((member) => member.id === sp.assignee)) assignee = sp.assignee
  }
  const attention = ATTENTION_FILTER_OPTIONS.some((option) => option.value === sp.attention)
    ? (sp.attention as LeadAttentionFilter)
    : null

  // Start the leads query now, in parallel with members. The board streams it
  // behind a Suspense boundary; the list view awaits it below.
  const leadsPromise = listLeads({
    view,
    ids: leadIds,
    q,
    status,
    source,
    solutionType,
    assignee,
    attention,
    page,
    sort,
    dir,
  })
  const members = await membersPromise

  const ASSIGNEE_FILTER_OPTIONS = members.map((m) => ({
    value: m.id,
    label: m.name,
    avatar: {
      name: m.name,
      avatar_url: m.avatar_url,
      github_handle: m.github_handle,
    },
  }))

  const hasFilters =
    leadIds.length > 0 ||
    q.length > 0 ||
    !!status ||
    !!source ||
    !!solutionType ||
    !!assignee ||
    !!attention

  // Changing any filter remounts the boundary so the skeleton shows again.
  const boardKey = JSON.stringify([q, status, source, solutionType, assignee, attention, leadIds])

  const actions = (
    <div className="ml-auto flex min-w-0 items-center gap-2">
      <LeadsViewToggle view={view} />
      <LeadCreateDialog
        trigger={
          <Button className="hidden sm:inline-flex">
            <Plus className="size-4" aria-hidden />
            Nuevo lead
          </Button>
        }
        mobileTrigger={
          <IconButton className="sm:hidden" label="Nuevo lead" size="icon-lg">
            <Plus className="size-4" aria-hidden />
          </IconButton>
        }
      />
    </div>
  )

  if (view === 'list') {
    const { leads: enrichedLeads, count, error } = await leadsPromise
    return (
      <LeadsList
        leads={enrichedLeads}
        aiEnabled={aiEnabled}
        canEdit={canEdit}
        members={members}
        senderName={user.name}
        title={leadIds.length ? 'Leads pendientes del aviso' : 'Leads'}
        actions={actions}
        error={error ?? undefined}
        empty={hasFilters ? 'Sin coincidencias.' : 'Aún no hay leads.'}
        emptyAction={<LeadCreateDialog />}
        searchKey="q"
        searchPlaceholder="Nombre, alias, empresa, email o teléfono…"
        controlsPresentation="panel"
        controlsMobileInline
        filters={[
          { key: 'status', label: 'Estado', options: STATUS_FILTER_OPTIONS },
          { key: 'source', label: 'Origen', options: SOURCE_FILTER_OPTIONS },
          { key: 'solution', label: 'Necesidad', options: SOLUTION_FILTER_OPTIONS },
          {
            key: 'assignee',
            label: 'Responsable',
            options: ASSIGNEE_FILTER_OPTIONS,
          },
          { key: 'attention', label: 'Atención', options: ATTENTION_FILTER_OPTIONS },
        ]}
        pagination={{ page, pageSize: LEAD_LIST_PAGE_SIZE, total: count }}
        columns={[
          { key: 'nombre', label: 'Nombre', sortKey: 'name' },
          { key: 'empresa', label: 'Empresa', sortKey: 'company' },
          { key: 'email', label: 'Email' },
          { key: 'telefono', label: 'Teléfono' },
          { key: 'campana', label: 'Campaña' },
          { key: 'estado', label: 'Estado', sortKey: 'status' },
          { key: 'proxima_accion', label: 'Próxima acción' },
          { key: 'score', label: 'Score', sortKey: 'score', align: 'right' },
          { key: 'responsable', label: 'Responsable' },
          { key: 'creado', label: 'Creado', sortKey: 'created_at' },
          { key: 'acciones', label: 'Acciones', align: 'right' },
        ]}

        exportFilename="leads"
        addHref="/leads/new"
        addLabel="Añadir lead"
      />
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden sm:gap-6">
      <PageHeader title="Leads" actions={actions} />

      <ListControls
        searchKey="q"
        searchPlaceholder="Nombre, alias, empresa, email o teléfono…"
        presentation="panel"
        mobileInline
        className="leads-kanban-filter-controls rounded-none border-0 bg-transparent shadow-none"
        filters={[
          { key: 'status', label: 'Estado', options: STATUS_FILTER_OPTIONS },
          { key: 'source', label: 'Origen', options: SOURCE_FILTER_OPTIONS },
          { key: 'solution', label: 'Necesidad', options: SOLUTION_FILTER_OPTIONS },
          {
            key: 'assignee',
            label: 'Responsable',
            options: ASSIGNEE_FILTER_OPTIONS,
          },
          { key: 'attention', label: 'Atención', options: ATTENTION_FILTER_OPTIONS },
        ]}
      />

      <Suspense key={boardKey} fallback={<LeadsBoardSkeleton />}>
        <LeadsBoard
          leadsPromise={leadsPromise}
          hasFilters={hasFilters}
          canEdit={canEdit}
          aiEnabled={aiEnabled}
          googleEnabled={googleEnabled}
          members={members}
        />
      </Suspense>
    </div>
  )
}
