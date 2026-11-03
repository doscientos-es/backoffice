import type { AssistantSource, HistoryItem } from './assistant-contract'
import { interactionBodyText } from './interaction-utils'
import type { LeadDetailResult } from './types'

const CONTEXT_BUDGET = 40_000

/** Only explicit, permission-filtered fields; never serialize payloads or archived transcripts. */
export function buildAssistantSources(
  detail: LeadDetailResult,
  interactions: HistoryItem[],
  permissions: { prices: boolean; finance: boolean },
): AssistantSource[] {
  const lead = detail.lead
  const base = `/leads/${lead.id}`
  const candidates: AssistantSource[] = []
  function add(id: string, label: string, href: string, data: unknown, date: string | null = null) {
    const text = JSON.stringify(data)
    const content =
      text.length > 5000
        ? `${text.slice(0, 4900)}\n[Fuente abreviada; abrir el enlace para ver el texto completo]`
        : text
    candidates.push({ id, label, href, createdAt: date, content })
  }
  add(`lead:${lead.id}`, 'Ficha del lead (estado actual)', base, {
    name: lead.name,
    company: lead.company,
    status: lead.status,
    notes: lead.notes,
    estimatedValue: permissions.prices ? lead.estimated_value : undefined,
    solutionType: lead.solution_type,
    urgency: lead.urgency,
    companySize: lead.company_size,
    lostReason: lead.lost_reason,
    lostAt: lead.lost_at,
    previousAiSummaryUnverified: lead.ai_summary,
  })
  for (const item of interactions) {
    add(
      `interaction:${item.id}`,
      item.subject || item.type,
      `${base}/history/${item.id}`,
      {
        // Meet's useful summary takes priority over potentially long scheduling/email notes.
        type: item.type,
        summary: item.summary,
        notes: interactionBodyText(item.body),
        excerptTruncated: item.truncated,
      },
      item.created_at,
    )
  }
  for (const item of detail.proposals.slice(0, 10)) {
    add(
      `proposal:${item.id}`,
      item.title || item.number || 'Propuesta',
      `/proposals/${item.id}`,
      {
        title: item.title,
        number: item.number,
        status: item.status,
        total: permissions.prices ? item.total : undefined,
        notes: item.notes,
        sentAt: item.sent_at,
        viewedAt: item.viewed_at,
        respondedAt: item.responded_at,
      },
      item.sent_at,
    )
  }
  for (const item of detail.tasks.slice(0, 10)) {
    add(`task:${item.id}`, item.title, `/tasks/${item.id}`, {
      title: item.title,
      status: item.status,
      description: item.description,
      dueDate: item.due_date,
    })
  }
  for (const item of detail.projects.slice(0, 5)) {
    add(`project:${item.id}`, item.name, `/projects/${item.id}`, {
      name: item.name,
      status: item.status,
      description: item.description,
    })
  }
  if (permissions.finance) {
    for (const item of detail.invoices.slice(0, 5)) {
      add(
        `invoice:${item.id}`,
        item.full_number || 'Factura',
        `/invoices/${item.id}`,
        {
          number: item.full_number,
          status: item.status,
          total: item.total,
        },
        item.issue_date,
      )
    }
  }
  add(
    'discovery',
    'Preguntas comerciales confirmadas',
    `${base}?tab=inteligencia`,
    detail.discoveryQuestions
      .filter((q) => q.status === 'answered')
      .slice(0, 15)
      .map((q) => ({ question: q.question, answer: q.answer })),
  )
  add(
    'reminders',
    'Recordatorios pendientes',
    base,
    detail.reminders.slice(0, 10).map((r) => ({ title: r.title, remindAt: r.remind_at })),
  )

  let remaining = CONTEXT_BUDGET
  const seen = new Set<string>()
  return candidates.filter((source) => {
    if (seen.has(source.id)) return false
    seen.add(source.id)
    const size = JSON.stringify(source).length
    if (size > remaining) return false
    remaining -= size
    return true
  })
}

/** Citations are resolved by the server, never accepted as model-generated URLs. */
export function resolveAssistantSources(ids: string[], sources: AssistantSource[]) {
  const index = new Map(sources.map((source) => [source.id, source]))
  return [...new Set(ids)].map((id) => {
    const source = index.get(id)
    if (!source) throw new Error('Unknown assistant source')
    const { content: _content, ...citation } = source
    return citation
  })
}
