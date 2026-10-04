'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { requirePermission, requireRole, requireUser } from '@/lib/auth'
import {
  ensureClientForProposal,
  ensureProjectForProposal,
  hasCompleteFiscalData,
  promoteLeadFromClient,
} from '@/lib/crm/conversion'
import { externalAppUrl } from '@/lib/email/app-url'
import { publicEnv } from '@/lib/env'
import { createProposalDraftInvoices } from '@/lib/invoices/proposal-drafts'
import { buildLeadStatusPatch } from '@/lib/leads/status-transitions'
import { scopedLogger } from '@/lib/logger'
import { buildPortalAccessPatch } from '@/lib/portal/access'
import {
  replaceProposalTeam,
  saveProposalEditorDraft,
  updateProposalRecord,
} from '@/lib/proposals/editor-save'
import { buildProposalItemRows, buildProposalTotalsPatch } from '@/lib/proposals/items'
import { ensureProposalMaintenanceSubscription } from '@/lib/proposals/maintenance-subscription'
import { DEFAULT_PROPOSAL_LEGAL_TERMS } from '@/lib/proposals/proposal-acceptance'
import { ensureCalendarYearProration, recurringPaymentTerms } from '@/lib/proposals/recurring'
import { parsePaymentPlan } from '@/lib/proposals/scope'
import { formatProposalValidationIssues } from '@/lib/proposals/validation'
import { UpdatePortalAccessInput } from '@/lib/schemas/portal'
import {
  AcceptProposalFiscalData,
  CreateProposalInput,
  type CreateProposalInputType,
  DuplicateProposalInput,
  SendProposalPreviewInput,
  UpdateProposalPaymentPlanInput,
} from '@/lib/schemas/proposal'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { formatDate, formatEUR } from '@/lib/utils'

const log = scopedLogger('proposals')

const PRE_QUOTE_LEAD_STATUSES = new Set(['new', 'contacted', 'in_conversation', 'qualifying'])

/**
 * Completes the CRM side of a first proposal delivery. A draft is internal;
 * only a proposal that has actually been sent puts its linked lead in the
 * Presupuestado stage. It also leaves a durable follow-up in the sender's
 * work queue after 72 hours.
 */
async function completeProposalDelivery(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  proposal: { id: string; title: string; lead_id: string | null; client_id: string | null },
  userId: string,
): Promise<string | null> {
  const { error: reminderError } = await supabase.from('tasks').insert({
    kind: 'reminder',
    title: `Seguimiento de propuesta · ${proposal.title}`,
    description: 'Revisar respuesta del cliente 72 horas después del envío.',
    start_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    lead_id: proposal.lead_id,
    client_id: proposal.client_id,
    created_by: userId,
    assignee_id: userId,
    status: 'todo',
    priority: 'high',
  })
  if (reminderError) {
    log.warn({ err: reminderError, proposalId: proposal.id }, 'proposal_follow_up_reminder_failed')
  }

  if (!proposal.lead_id) return null
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('status')
    .eq('id', proposal.lead_id)
    .maybeSingle()
  if (leadError || !lead || !PRE_QUOTE_LEAD_STATUSES.has(lead.status as string)) {
    if (leadError)
      log.warn({ err: leadError, proposalId: proposal.id }, 'proposal_lead_read_failed')
    return proposal.lead_id
  }

  const now = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('leads')
    .update(buildLeadStatusPatch({ status: 'quoted', userId, now }))
    .eq('id', proposal.lead_id)
  if (updateError) {
    log.warn({ err: updateError, proposalId: proposal.id }, 'proposal_lead_quote_sync_failed')
    return proposal.lead_id
  }

  const { error: interactionError } = await supabase.from('lead_interactions').insert({
    lead_id: proposal.lead_id,
    type: 'status_change',
    subject: `Estado: ${lead.status as string} → quoted`,
    performed_by: userId,
    payload: { from: lead.status as string, to: 'quoted', proposal_id: proposal.id },
  })
  if (interactionError) {
    log.warn(
      { err: interactionError, proposalId: proposal.id },
      'proposal_lead_quote_interaction_failed',
    )
  }
  return proposal.lead_id
}

/**
 * Allocates the next sequential proposal number for the current year. Called
 * only at the first transition to `sent` so drafts don't consume numbers in
 * the legal series.
 */
async function nextProposalNumber(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
): Promise<string> {
  const year = new Date().getUTCFullYear()
  const prefix = `P-${year}-`
  const { data } = await supabase
    .from('proposals')
    .select('number')
    .like('number', `${prefix}%`)
    .order('number', { ascending: false })
    .limit(1)
  const last = data?.[0]?.number as string | undefined
  const lastSeq = last ? Number.parseInt(last.slice(prefix.length), 10) || 0 : 0
  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`
}

/**
 * Shared insert path used by both the FormData and JSON entry points. The
 * proposal lands as a draft without a number — numbers are assigned on the
 * first transition to `sent` via `sendPreviewLink`.
 */
async function insertDraftProposal(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  data: CreateProposalInputType,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const items = ensureCalendarYearProration(data.items, new Date())
  const totals = buildProposalTotalsPatch(items)
  const automaticPaymentTerms = recurringPaymentTerms(items, new Date())

  const { data: proposal, error } = await supabase
    .from('proposals')
    .insert({
      client_id: data.client_id ?? null,
      lead_id: data.lead_id ?? null,
      project_id: data.project_id ?? null,
      number: null,
      title: data.title,
      status: 'draft',
      currency: 'EUR',
      ...totals,
      valid_until: data.valid_until ?? null,
      notes: data.notes ?? null,
      legal_terms: DEFAULT_PROPOSAL_LEGAL_TERMS,
      ...(automaticPaymentTerms
        ? { payment_schedule: 'custom', payment_terms: automaticPaymentTerms }
        : {}),
      created_by: userId,
    })
    .select('id')
    .single()

  if (error || !proposal) {
    log.error({ err: error }, 'create_proposal_failed')
    return { ok: false, error: error?.message ?? 'No se pudo crear la propuesta' }
  }

  const { error: itemsError } = await supabase
    .from('proposal_items')
    .insert(buildProposalItemRows(items, proposal.id))
  if (itemsError) {
    log.error({ err: itemsError, proposalId: proposal.id }, 'create_proposal_items_failed')
    return { ok: false, error: itemsError.message }
  }

  return { ok: true, id: proposal.id as string }
}

/** Creates the recurring maintenance contract represented by an accepted proposal. */
export async function createSubscriptionFromProposal(
  input: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await requirePermission('finance.write')
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'ID de propuesta no válido' }

  const supabase = await createServerClient()
  const result = await ensureProposalMaintenanceSubscription(supabase, parsed.data.id, user.id)
  if (!result.ok || !result.id) {
    const error = result.ok ? 'No se pudo crear la suscripción' : result.error
    log.error({ err: error, proposalId: parsed.data.id }, 'proposal_subscription_create_failed')
    return { ok: false, error }
  }

  revalidatePath(`/proposals/${parsed.data.id}`)
  revalidatePath('/subscriptions')
  return { ok: true, id: result.id }
}

export async function createProposal(formData: FormData): Promise<void> {
  const user = await requireUser()

  const itemsRaw = formData.get('items')?.toString() ?? '[]'
  let items: unknown
  try {
    items = JSON.parse(itemsRaw)
  } catch {
    throw new Error('Líneas no válidas')
  }

  const parsed = CreateProposalInput.safeParse({
    client_id: formData.get('client_id')?.toString() ?? '',
    lead_id: formData.get('lead_id')?.toString() ?? '',
    title: formData.get('title')?.toString() ?? '',
    valid_until: formData.get('valid_until')?.toString() ?? '',
    notes: formData.get('notes')?.toString() ?? '',
    items,
  })
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Datos no válidos')
  }

  const supabase = await createServerClient()
  const res = await insertDraftProposal(supabase, user.id, parsed.data)
  if (!res.ok) throw new Error(res.error)

  revalidatePath('/proposals')
  redirect(`/proposals/${res.id}`)
}

/**
 * JSON version of createProposal for use with client-side calls.
 * Returns the created proposal ID on success.
 */
export async function createProposalAction(
  input: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await requireUser()

  const parsed = CreateProposalInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos no válidos' }
  }

  const supabase = await createServerClient()
  const res = await insertDraftProposal(supabase, user.id, parsed.data)
  if (!res.ok) return res

  revalidatePath('/proposals')
  return { ok: true, id: res.id }
}

/**
 * Clones an existing proposal as a new draft. Resets status, portal token,
 * number, timestamps and signature data; copies title (prefixed "Copia de"),
 * target, narrative blocks, commercial terms and line items. Useful for
 * re-quoting after a rejection or when iterating with the same client.
 */
export async function duplicateProposal(
  input: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await requireUser()

  const parsed = DuplicateProposalInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Identificador no válido' }
  }

  const supabase = await createServerClient()
  const { data: source, error: readError } = await supabase
    .from('proposals')
    .select(
      'client_id, lead_id, title, valid_until, notes, context_markdown, problems, solutions, terms, legal_terms, scope_modules, deliverables, acceptance_criteria, payment_schedule, payment_terms, change_management_terms, subtotal, tax_amount, total, currency',
    )
    .eq('id', parsed.data.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (readError || !source) return { ok: false, error: 'Propuesta no encontrada' }

  const { data: items, error: itemsErr } = await supabase
    .from('proposal_items')
    .select('position, description, quantity, unit_price, vat_rate, billing_cycle')
    .eq('proposal_id', parsed.data.id)
    .order('position')
  if (itemsErr) return { ok: false, error: itemsErr.message }

  const duplicatedItems = ensureCalendarYearProration(items ?? [], new Date())
  const duplicatedTotals = buildProposalTotalsPatch(duplicatedItems)
  const automaticPaymentTerms = recurringPaymentTerms(duplicatedItems, new Date())

  const { data: created, error: insertError } = await supabase
    .from('proposals')
    .insert({
      client_id: source.client_id,
      lead_id: source.lead_id,
      number: null,
      title: `Copia de ${source.title as string}`,
      status: 'draft',
      currency: (source.currency as string) ?? 'EUR',
      ...duplicatedTotals,
      valid_until: null,
      notes: source.notes,
      context_markdown: source.context_markdown,
      problems: source.problems,
      solutions: source.solutions,
      terms: source.terms,
      legal_terms: source.legal_terms ?? DEFAULT_PROPOSAL_LEGAL_TERMS,
      scope_modules: source.scope_modules,
      deliverables: source.deliverables,
      acceptance_criteria: source.acceptance_criteria,
      payment_schedule: automaticPaymentTerms ? 'custom' : source.payment_schedule,
      payment_terms: source.payment_terms ?? automaticPaymentTerms,
      change_management_terms: source.change_management_terms,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (insertError || !created) {
    log.error({ err: insertError, sourceId: parsed.data.id }, 'duplicate_proposal_failed')
    return { ok: false, error: insertError?.message ?? 'No se pudo duplicar la propuesta' }
  }

  if (duplicatedItems.length > 0) {
    const { error: copyErr } = await supabase.from('proposal_items').insert(
      duplicatedItems.map((it, idx) => ({
        proposal_id: created.id,
        position: idx,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        vat_rate: it.vat_rate,
        billing_cycle: it.billing_cycle,
      })),
    )
    if (copyErr) {
      log.error({ err: copyErr, sourceId: parsed.data.id }, 'duplicate_proposal_items_failed')
      return { ok: false, error: copyErr.message }
    }
  }

  revalidatePath('/proposals')
  return { ok: true, id: created.id as string }
}

// ---------------- UPDATE (explicit inline edits) ----------------

type UpdateResult = { ok: true; version: number } | { ok: false; error: string; code?: 'conflict' }

export async function updateProposal(input: unknown): Promise<UpdateResult> {
  return updateProposalRecord(input)
}

/** Saves the editor draft and its team in one server request. */
export async function saveProposalEditor(input: unknown) {
  return saveProposalEditorDraft(input)
}

/**
 * Updates only the payment calendar after acceptance. Amounts already attached
 * to a draft or issued invoice stay frozen in the plan to prevent divergence.
 */
export async function updateProposalPaymentPlan(input: unknown): Promise<UpdateResult> {
  const user = await requireUser()
  if (user.role === 'viewer')
    return { ok: false, error: 'No tienes permiso para editar el calendario' }
  const parsed = UpdateProposalPaymentPlanInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: formatProposalValidationIssues(parsed.error.issues).join('\n') }
  }

  const { id, expected_version, payment_plan } = parsed.data
  const supabase = await createServerClient()
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('status, payment_plan')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (proposalError || !proposal) return { ok: false, error: 'Propuesta no encontrada' }
  if (proposal.status === 'rejected') return { ok: false, error: 'La propuesta está rechazada' }

  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('proposal_payment_plan_item_id')
    .eq('proposal_id', id)
    .is('deleted_at', null)
    .not('proposal_payment_plan_item_id', 'is', null)
  if (invoicesError) return { ok: false, error: invoicesError.message }

  const oldPlan = new Map(parsePaymentPlan(proposal.payment_plan).map((item) => [item.id, item]))
  const nextPlan = new Map(payment_plan.map((item) => [item.id, item]))
  for (const invoice of invoices ?? []) {
    const itemId = invoice.proposal_payment_plan_item_id as string | null
    if (!itemId) continue
    const previous = oldPlan.get(itemId)
    const next = nextPlan.get(itemId)
    if (!previous || !next || next.percentage !== previous.percentage) {
      return {
        ok: false,
        error:
          'No puedes cambiar el importe ni eliminar un plazo que ya tiene una factura preparada',
      }
    }
  }

  const { data, error: updateError } = await supabase
    .from('proposals')
    .update({ payment_plan })
    .eq('id', id)
    .eq('version', expected_version)
    .select('version')
    .maybeSingle()
  if (updateError) return { ok: false, error: updateError.message }
  if (!data) {
    return {
      ok: false,
      code: 'conflict',
      error: 'Este registro ha cambiado mientras lo editabas.',
    }
  }

  revalidatePath(`/proposals/${id}`)
  return { ok: true, version: Number(data.version) }
}

// ---------------- LINK PROJECT ----------------

/**
 * Sets or clears the `project_id` on a proposal. Passing `project_id: null`
 * unlinks the proposal from any project. Works on any proposal status so the
 * team can connect proposals created before the project existed.
 */
export async function linkProposalToProject(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser()

  const parsed = z
    .object({ proposal_id: z.string().uuid(), project_id: z.string().uuid().nullable() })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Datos no válidos' }

  const { proposal_id, project_id } = parsed.data
  const supabase = await createServerClient()

  const { error } = await supabase
    .from('proposals')
    .update({ project_id })
    .eq('id', proposal_id)
    .is('deleted_at', null)

  if (error) {
    log.error({ err: error, proposal_id }, 'link_proposal_to_project_failed')
    return { ok: false, error: error.message }
  }

  revalidatePath(`/proposals/${proposal_id}`)
  if (project_id) revalidatePath(`/projects/${project_id}`)
  return { ok: true }
}

// ---------------- PROPOSAL TEAM ----------------

/** Replaces the people shown as the project team in the client deck. */
export async function setProposalTeamMembers(input: unknown) {
  return replaceProposalTeam(input)
}

// ---------------- DELETE (soft) ----------------

/**
 * Soft-deletes a proposal by stamping `deleted_at`. The associated invoice
 * FK (`invoices.proposal_id`) is `on delete set null` at the DB level, so
 * already-issued invoices keep their data even after deletion. Reversible
 * by clearing `deleted_at` directly in the database.
 */
export async function deleteProposal(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser()
  const id = formData.get('id')?.toString() ?? ''
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'ID inválido' }

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('proposals')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    log.error({ err: error, id }, 'delete_proposal_failed')
    return { ok: false, error: error.message }
  }

  revalidatePath('/proposals')
  return { ok: true }
}

/**
 * Reverses a soft-delete by clearing `deleted_at`. Backs the "Deshacer" toast
 * shown after `deleteProposal`. Mirrors `deleteProposal`'s FormData signature.
 */
export async function restoreProposal(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser()
  const id = formData.get('id')?.toString() ?? ''
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'ID inválido' }

  const supabase = await createServerClient()
  const { error } = await supabase.from('proposals').update({ deleted_at: null }).eq('id', id)

  if (error) {
    log.error({ err: error, id }, 'restore_proposal_failed')
    return { ok: false, error: error.message }
  }

  revalidatePath(`/proposals/${id}`)
  revalidatePath('/proposals')
  return { ok: true }
}

// ---------------- PORTAL ACCESS (visibility + password) ----------------

/**
 * Updates the public-link access controls of a proposal: the
 * `is_client_visible` toggle and/or the optional password gate. Each field is
 * independent — omit one to leave it untouched. `password: null` clears it.
 */
export async function updateProposalPortalAccess(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser()
  const parsed = UpdatePortalAccessInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos no válidos' }
  }
  const patch = buildPortalAccessPatch(parsed.data)
  if (Object.keys(patch).length === 0) return { ok: true }

  const supabase = await createServerClient()
  const { error } = await supabase.from('proposals').update(patch).eq('id', parsed.data.id)
  if (error) {
    log.error({ err: error, id: parsed.data.id }, 'update_proposal_portal_access_failed')
    return { ok: false, error: error.message }
  }

  revalidatePath(`/proposals/${parsed.data.id}`)
  return { ok: true }
}

// ---------------- MARK AS SENT (without email) ----------------

/**
 * Transitions a draft proposal to `sent` and assigns it a legal number without sending any email — useful when the proposal was delivered in person, by phone, or through another channel.
 */
export async function markProposalAsSent(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser()

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'ID inválido' }
  const { id } = parsed.data

  const supabase = await createServerClient()
  const { data: proposal, error: readError } = await supabase
    .from('proposals')
    .select('id, number, status, title, lead_id, client_id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (readError || !proposal) return { ok: false, error: 'Propuesta no encontrada' }
  if (proposal.status !== 'draft') return { ok: true } // idempotent

  const number = (proposal.number as string | null) ?? (await nextProposalNumber(supabase))
  const { error } = await supabase
    .from('proposals')
    .update({ number, status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    log.error({ err: error, id }, 'mark_proposal_as_sent_failed')
    return { ok: false, error: error.message }
  }

  const leadId = await completeProposalDelivery(
    supabase,
    {
      id,
      title: proposal.title as string,
      lead_id: (proposal.lead_id as string | null) ?? null,
      client_id: (proposal.client_id as string | null) ?? null,
    },
    user.id,
  )

  revalidatePath(`/proposals/${id}`)
  revalidatePath('/proposals')
  if (leadId) revalidatePath(`/leads/${leadId}`)
  revalidatePath('/leads')
  revalidatePath('/inicio')
  return { ok: true }
}

// ---------------- SEND PREVIEW LINK (client portal) ----------------

type SendPreviewResult =
  | { ok: true; portalUrl: string; mocked: boolean }
  | { ok: false; error: string }

type ProposalEmailPreviewResult =
  | {
      ok: true
      subject: string
      html: string
      clientName: string
      clientPhone: string | null
      proposalNumber: string
      portalUrl: string
    }
  | { ok: false; error: string }

type ProposalEmailData = {
  id: string
  number: string | null
  title: string
  total: number
  valid_until: string | null
  portal_token: string | null
  clients: {
    name: string
    email: string | null
    phone: string | null
    leads?: { language: 'es' | 'ca' | 'en' | null } | null
  } | null
  leads: {
    name: string
    email: string | null
    phone: string | null
    language: 'es' | 'ca' | 'en' | null
  } | null
}

async function renderProposalPreview(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  proposal: ProposalEmailData,
  message: string | undefined,
): Promise<
  | { ok: true; proposalNumber: string; portalUrl: string; subject: string; html: string }
  | { ok: false; error: string }
> {
  const portalToken = proposal.portal_token
  if (!portalToken) return { ok: false, error: 'La propuesta no tiene token de portal' }

  const appUrl = externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL)
  const language = proposal.leads?.language ?? proposal.clients?.leads?.language ?? 'es'
  const proposalNumber = proposal.number ?? (await nextProposalNumber(supabase))
  const { data: specs } = await supabase
    .from('proposal_specs')
    .select('title, portal_token')
    .eq('proposal_id', proposal.id)
    .eq('is_client_visible', true)
    .not('portal_token', 'is', null)

  const specLinks = ((specs ?? []) as Array<{ title: string; portal_token: string }>)
    .filter((spec) => spec.portal_token)
    .map((spec) => ({
      title: spec.title,
      url: `${appUrl}/p/spec/${spec.portal_token}?lang=${language}`,
    }))
  const portalUrl = `${appUrl}/p/proposal/${portalToken}?lang=${language}`
  const [{ ProposalEmail }, { renderEmail }] = await Promise.all([
    import('@/components/email'),
    import('@/lib/email/render'),
  ])
  const html = await renderEmail(
    ProposalEmail({
      clientName: proposal.clients?.name ?? proposal.leads?.name ?? 'Hola',
      proposalTitle: proposal.title,
      proposalNumber,
      total: formatEUR(proposal.total),
      validUntil: proposal.valid_until ? formatDate(proposal.valid_until) : undefined,
      portalUrl,
      // The presentation deck is still Spanish-only. Keep it out of CA/EN
      // emails until its slide copy is localized instead of implying otherwise.
      deckUrl: language === 'es' ? `${appUrl}/deck/${portalToken}` : undefined,
      appUrl,
      message,
      specs: specLinks,
      language,
    }),
  )

  return {
    ok: true,
    proposalNumber,
    portalUrl,
    subject:
      language === 'ca'
        ? `Proposta ${proposalNumber} · ${proposal.title}`
        : language === 'en'
          ? `Proposal ${proposalNumber} · ${proposal.title}`
          : `Propuesta ${proposalNumber} · ${proposal.title}`,
    html,
  }
}

/** Renders the exact proposal email for review without delivering it. */
export async function previewProposalEmail(input: unknown): Promise<ProposalEmailPreviewResult> {
  await requireUser()

  const parsed = SendProposalPreviewInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos no válidos' }
  }

  const supabase = await createServerClient()
  const { data: proposal, error } = await supabase
    .from('proposals')
    .select(
      'id, number, title, total, portal_token, valid_until, clients(name, email, phone, lead_id, leads(language)), leads(name, email, phone, language)',
    )
    .eq('id', parsed.data.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !proposal) return { ok: false, error: 'Propuesta no encontrada' }

  const rendered = await renderProposalPreview(
    supabase,
    proposal as unknown as ProposalEmailData,
    parsed.data.message,
  )
  if (!rendered.ok) return rendered
  const proposalEmailData = proposal as unknown as ProposalEmailData
  const client = proposalEmailData.clients
  const lead = proposalEmailData.leads
  return {
    ok: true,
    subject: rendered.subject,
    html: rendered.html,
    clientName: client?.name ?? lead?.name ?? 'cliente',
    clientPhone: client?.phone ?? lead?.phone ?? null,
    proposalNumber: rendered.proposalNumber,
    portalUrl: rendered.portalUrl,
  }
}

/**
 * Sends the public portal URL of a proposal to the client via Resend and
 * transitions the proposal from `draft` → `sent` (setting `sent_at`).
 * Idempotent for already-sent proposals.
 */
export async function sendPreviewLink(input: unknown): Promise<SendPreviewResult> {
  const user = await requireUser()

  const parsed = SendProposalPreviewInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos no válidos' }
  }
  const { id, to: overrideTo, message } = parsed.data

  const supabase = await createServerClient()
  const { data: proposal, error: readError } = await supabase
    .from('proposals')
    .select(
      'id, number, title, total, status, portal_token, valid_until, sent_at, lead_id, client_id, clients(name, email, phone, lead_id, leads(language)), leads(name, email, phone, language)',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (readError || !proposal) return { ok: false, error: 'Propuesta no encontrada' }

  // Recipient: prefer the explicit override, otherwise fall back to the
  // client email and finally to the lead email when the proposal targets a
  // lead that hasn't yet been upgraded to a client.
  const proposalEmailData = proposal as unknown as ProposalEmailData
  const client = proposalEmailData.clients
  const lead = proposalEmailData.leads
  const recipient = overrideTo ?? client?.email ?? lead?.email ?? null
  if (!recipient) return { ok: false, error: 'El destinatario no tiene email registrado' }

  const rendered = await renderProposalPreview(supabase, proposalEmailData, message)
  if (!rendered.ok) return rendered
  const { proposalNumber, portalUrl, subject, html } = rendered

  let mocked = false
  try {
    const { sendEmail } = await import('@/lib/email/resend')
    const result = await sendEmail({
      fromName: user.name,
      fromAlias: user.emailAlias ?? 'propuestas',
      to: recipient,
      replyTo: user.contactEmail ?? user.email,
      subject,
      html,
      tags: { proposal_id: id, kind: 'proposal_preview' },
    })
    mocked = result.mocked
  } catch (err) {
    log.error({ err, proposalId: id }, 'send_preview_link_failed')
    return { ok: false, error: err instanceof Error ? err.message : 'No se pudo enviar el email' }
  }

  const patch: Record<string, unknown> = {}
  if (!proposal.number) patch.number = proposalNumber
  if (proposal.status === 'draft') {
    patch.status = 'sent'
    patch.sent_at = new Date().toISOString()
  } else if (!proposal.sent_at) {
    patch.sent_at = new Date().toISOString()
  }
  let syncedLeadId: string | null = null
  if (Object.keys(patch).length > 0) {
    const { error: updateError } = await supabase.from('proposals').update(patch).eq('id', id)
    if (updateError) {
      log.error({ err: updateError, id }, 'send_preview_link_update_failed')
    } else if (proposal.status === 'draft') {
      syncedLeadId = await completeProposalDelivery(
        supabase,
        {
          id,
          title: proposal.title as string,
          lead_id: (proposal.lead_id as string | null) ?? null,
          client_id: (proposal.client_id as string | null) ?? null,
        },
        user.id,
      )
    }
  }

  revalidatePath(`/proposals/${id}`)
  revalidatePath('/proposals')
  if (syncedLeadId) revalidatePath(`/leads/${syncedLeadId}`)
  if (syncedLeadId) revalidatePath('/leads')
  if (proposal.status === 'draft') revalidatePath('/inicio')
  return { ok: true, portalUrl, mocked }
}

// ---------------- MANUAL RESPONSE ----------------

/**
 * Records a rejection communicated outside the client portal. Only proposals
 * that have already been delivered can be rejected manually.
 */
export async function markProposalAsRejected(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requirePermission('proposals.write')

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'ID inválido' }
  const { id } = parsed.data

  const supabase = await createServerClient()
  const { data: proposal, error: readError } = await supabase
    .from('proposals')
    .select('id, status, number')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (readError || !proposal) return { ok: false, error: 'Propuesta no encontrada' }
  if (proposal.status === 'rejected') return { ok: true }
  if (!['sent', 'viewed', 'expired'].includes(proposal.status as string)) {
    return { ok: false, error: 'Solo se pueden rechazar propuestas enviadas, vistas o expiradas' }
  }

  const { error } = await supabase
    .from('proposals')
    .update({ status: 'rejected', responded_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    log.error({ err: error, id }, 'mark_proposal_as_rejected_failed')
    return { ok: false, error: error.message }
  }

  log.info({ id, number: proposal.number, by: user.email }, 'proposal_manually_rejected')
  revalidatePath(`/proposals/${id}`)
  revalidatePath('/proposals')
  return { ok: true }
}

/**
 * Allows team members to mark a proposal as accepted without the client
 * going through the portal — useful when acceptance happened in person or by phone.
 * Idempotent: already-accepted proposals return ok immediately.
 */
export async function markProposalAsAccepted(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requirePermission('proposals.write')

  const parsed = z
    .object({ id: z.string().uuid(), fiscal: AcceptProposalFiscalData.optional() })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: 'ID inválido' }
  const { id } = parsed.data

  const supabase = await createServerClient()
  const { data: proposal, error: readError } = await supabase
    .from('proposals')
    .select('id, number, status, client_id, lead_id, clients(name, nif, billing_address_street)')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (readError || !proposal) return { ok: false, error: 'Propuesta no encontrada' }
  if (proposal.status === 'rejected')
    return { ok: false, error: 'No se puede aceptar una propuesta rechazada' }

  const client = (
    proposal as unknown as {
      clients: {
        name: string | null
        nif: string | null
        billing_address_street: string | null
      } | null
    }
  ).clients
  const needsFiscal = proposal.lead_id != null || !client || !hasCompleteFiscalData(client)
  if (proposal.status === 'accepted' && !needsFiscal) return { ok: true }
  let fiscal: z.infer<typeof AcceptProposalFiscalData> | undefined
  if (needsFiscal) {
    const fiscalResult = AcceptProposalFiscalData.safeParse(parsed.data.fiscal)
    if (!fiscalResult.success) {
      return {
        ok: false,
        error: fiscalResult.error.errors[0]?.message ?? 'Datos fiscales no válidos',
      }
    }
    fiscal = fiscalResult.data

    const ensured = await ensureClientForProposal(supabase, id, fiscal)
    if ('error' in ensured) return { ok: false, error: ensured.error }
  }

  // Ensure it has a number (drafts that were never sent won't have one yet).
  const number =
    proposal.status === 'accepted'
      ? (proposal.number as string | null)
      : ((proposal.number as string | null) ?? (await nextProposalNumber(supabase)))

  const { error } = await supabase
    .from('proposals')
    .update({
      ...(number ? { number } : {}),
      ...(proposal.status === 'accepted'
        ? {}
        : { status: 'accepted', responded_at: new Date().toISOString() }),
      accepted_fiscal_data: fiscal ?? null,
    })
    .eq('id', id)

  if (error) {
    log.error({ err: error, id }, 'mark_proposal_as_accepted_failed')
    return { ok: false, error: error.message }
  }

  // Best-effort Drive backup — fires as the acting user.
  void import('@/lib/google/backup')
    .then(({ backupProposalToDrive }) => backupProposalToDrive(id, user.email))
    .catch((err) => log.warn({ err, proposalId: id }, 'proposal_drive_backup_failed'))

  try {
    await ensureProjectForProposal(supabase, id)
    const { data: full } = await supabase
      .from('proposals')
      .select('client_id')
      .eq('id', id)
      .maybeSingle()
    if (full?.client_id) await promoteLeadFromClient(supabase, full.client_id as string)
  } catch (err) {
    log.warn({ err, proposalId: id }, 'manual_proposal_accept_side_effects_failed')
  }

  try {
    const result = await createProposalDraftInvoices(createAdminClient(), id, user.id)
    log.info({ proposalId: id, created: result.created }, 'proposal_invoice_drafts_created')
  } catch (err) {
    log.warn({ err, proposalId: id }, 'proposal_invoice_drafts_failed')
  }

  const { sendProposalAcceptedEmail } =
    await import('@/lib/integrations/send-proposal-accepted-email')
  await sendProposalAcceptedEmail(id)

  revalidatePath(`/proposals/${id}`)
  revalidatePath('/proposals')
  revalidatePath('/invoices')
  return { ok: true }
}

/**
 * Reopens an accepted or rejected proposal so the team can make adjustments
 * (e.g. a discount agreed in a follow-up meeting) and resend it for
 * re-acceptance. Only owners and admins can reopen.
 *
 * Clears the response fields (responded_at, signature_data, accepted_fiscal_data)
 * and reverts the status to `sent`, keeping the original number and portal token
 * intact so the client link remains valid.
 */
export async function reopenProposal(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requirePermission('proposals.write')

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'ID inválido' }
  const { id } = parsed.data

  const supabase = await createServerClient()
  const { data: proposal, error: readError } = await supabase
    .from('proposals')
    .select('id, status, number, delivered_at')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (readError || !proposal) return { ok: false, error: 'Propuesta no encontrada' }
  if (proposal.status !== 'accepted' && proposal.status !== 'rejected') {
    return { ok: false, error: 'Solo se pueden reabrir propuestas aceptadas o rechazadas' }
  }
  if (proposal.delivered_at) {
    return { ok: false, error: 'La propuesta ya está terminada: el cliente firmó el albarán' }
  }

  const { error } = await supabase
    .from('proposals')
    .update({
      status: 'sent',
      responded_at: null,
      signature_data: null,
      accepted_fiscal_data: null,
      acceptance_email_sent_at: null,
      acceptance_email_recipient: null,
      acceptance_email_resend_id: null,
    })
    .eq('id', id)

  if (error) {
    log.error({ err: error, id }, 'reopen_proposal_failed')
    return { ok: false, error: error.message }
  }

  log.info({ id, number: proposal.number, by: user.email }, 'proposal_reopened')

  revalidatePath(`/proposals/${id}`)
  revalidatePath('/proposals')
  return { ok: true }
}
