import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'

export type EmailMarketingList = {
  id: string
  name: string
  description: string | null
  created_at: string
  contact_count: number
}

export type EmailMarketingStep = {
  id: string
  sequence_id: string
  position: number
  title: string
  subject: string
  preview_text: string | null
  body_markdown: string
  scheduled_at: string
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'failed'
  sent_at: string | null
  last_error: string | null
  stats: {
    recipients: number
    delivered: number
    opened: number
    clicked: number
    unsubscribed: number
    bounced: number
    complained: number
    converted: number
  }
}

export type EmailMarketingSequence = {
  id: string
  list_id: string
  list_name: string
  name: string
  status: 'draft' | 'active' | 'paused' | 'completed'
  created_at: string
  steps: EmailMarketingStep[]
}

export type EmailMarketingRecipientEvent = {
  email: string
  name: string | null
  company: string | null
  status: string
  sent_at: string | null
  delivered_at: string | null
  opened_at: string | null
  click_count: number
  unsubscribed_at: string | null
  bounced_at: string | null
  complained_at: string | null
  converted_lead_id: string | null
}

export async function getEmailMarketingOverview(): Promise<{
  lists: EmailMarketingList[]
  sequences: EmailMarketingSequence[]
}> {
  const supabase = await createServerClient()
  const [listResult, sequenceResult] = await Promise.all([
    supabase
      .from('email_marketing_lists')
      .select('id, name, description, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('email_marketing_sequences')
      .select(
        'id, list_id, name, status, created_at, list:email_marketing_lists(name), steps:email_marketing_sequence_steps(id, sequence_id, position, title, subject, preview_text, body_markdown, scheduled_at, status, sent_at, last_error)',
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
  ])

  const listRows = (listResult.data ?? []) as unknown as Omit<EmailMarketingList, 'contact_count'>[]
  const listIds = listRows.map((row) => row.id)
  const memberCounts = new Map<string, number>()
  if (listIds.length) {
    const { data } = await supabase
      .from('email_marketing_list_members')
      .select('list_id, contact:email_marketing_contacts(status)')
      .in('list_id', listIds)
    for (const row of (data ?? []) as unknown as {
      list_id: string
      contact: { status: string } | null
    }[]) {
      if (row.contact?.status === 'subscribed')
        memberCounts.set(row.list_id, (memberCounts.get(row.list_id) ?? 0) + 1)
    }
  }
  const lists = listRows.map((row) => ({
    ...row,
    contact_count: memberCounts.get(row.id) ?? 0,
  }))

  const rawSequences = (sequenceResult.data ?? []) as unknown as {
    id: string
    list_id: string
    name: string
    status: EmailMarketingSequence['status']
    created_at: string
    list: { name: string } | null
    steps: Omit<EmailMarketingStep, 'stats'>[] | null
  }[]
  const stepIds = rawSequences.flatMap((sequence) => (sequence.steps ?? []).map((step) => step.id))
  const statsByStep = new Map<string, EmailMarketingStep['stats']>()
  if (stepIds.length) {
    const { data } = await supabase
      .from('lead_campaign_sends')
      .select(
        'sequence_step_id, sent_at, delivered_at, opened_at, clicked_at, unsubscribed_at, bounced_at, complained_at, converted_lead_id, marketing_send_status',
      )
      .in('sequence_step_id', stepIds)
    for (const row of (data ?? []) as unknown as {
      sequence_step_id: string
      sent_at: string | null
      delivered_at: string | null
      opened_at: string | null
      clicked_at: string | null
      unsubscribed_at: string | null
      bounced_at: string | null
      complained_at: string | null
      converted_lead_id: string | null
      marketing_send_status: string
    }[]) {
      const stats = statsByStep.get(row.sequence_step_id) ?? {
        recipients: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        unsubscribed: 0,
        bounced: 0,
        complained: 0,
        converted: 0,
      }
      if (row.marketing_send_status !== 'skipped') stats.recipients += 1
      if (row.delivered_at) stats.delivered += 1
      if (row.opened_at) stats.opened += 1
      if (row.clicked_at) stats.clicked += 1
      if (row.unsubscribed_at) stats.unsubscribed += 1
      if (row.bounced_at) stats.bounced += 1
      if (row.complained_at) stats.complained += 1
      if (row.converted_lead_id) stats.converted += 1
      statsByStep.set(row.sequence_step_id, stats)
    }
  }

  const sequences = rawSequences.map((sequence) => ({
    id: sequence.id,
    list_id: sequence.list_id,
    list_name: sequence.list?.name ?? 'Lista archivada',
    name: sequence.name,
    status: sequence.status,
    created_at: sequence.created_at,
    steps: (sequence.steps ?? [])
      .toSorted((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
      .map((step, index) => ({
        ...step,
        position: index + 1,
        stats: statsByStep.get(step.id) ?? {
          recipients: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          unsubscribed: 0,
          bounced: 0,
          complained: 0,
          converted: 0,
        },
      }))
      .sort((a, b) => a.position - b.position),
  }))

  return { lists, sequences }
}

export async function getEmailMarketingStepDetails(stepId: string, page: number) {
  const supabase = await createServerClient()
  const pageSize = 50
  const offset = Math.max(0, page - 1) * pageSize
  const { data: step, error: stepError } = await supabase
    .from('email_marketing_sequence_steps')
    .select(
      'id, title, subject, scheduled_at, status, sent_at, sequence:email_marketing_sequences(name, list:email_marketing_lists(name))',
    )
    .eq('id', stepId)
    .maybeSingle()
  if (stepError || !step) return null

  const countBase = () =>
    supabase
      .from('lead_campaign_sends')
      .select('id', { count: 'exact', head: true })
      .eq('sequence_step_id', stepId)
  const [sendResult, delivered, opened, clicked, unsubscribed, bounced, complained, converted] =
    await Promise.all([
      supabase
        .from('lead_campaign_sends')
        .select(
          'id, email, marketing_send_status, sent_at, delivered_at, opened_at, click_count, unsubscribed_at, bounced_at, complained_at, converted_lead_id, contact:email_marketing_contacts(name, company)',
          { count: 'exact' },
        )
        .eq('sequence_step_id', stepId)
        .order('email', { ascending: true })
        .range(offset, offset + pageSize - 1),
      countBase().not('delivered_at', 'is', null),
      countBase().not('opened_at', 'is', null),
      countBase().gt('click_count', 0),
      countBase().not('unsubscribed_at', 'is', null),
      countBase().not('bounced_at', 'is', null),
      countBase().not('complained_at', 'is', null),
      countBase().not('converted_lead_id', 'is', null),
    ])
  const rows = (sendResult.data ?? []) as unknown as {
    id: string
    email: string
    marketing_send_status: string
    sent_at: string | null
    delivered_at: string | null
    opened_at: string | null
    click_count: number
    unsubscribed_at: string | null
    bounced_at: string | null
    complained_at: string | null
    converted_lead_id: string | null
    contact: { name: string | null; company: string | null } | null
  }[]
  return {
    step: step as unknown as {
      id: string
      title: string
      subject: string
      scheduled_at: string
      status: string
      sent_at: string | null
      sequence: { name: string; list: { name: string } | null } | null
    },
    page,
    pageSize,
    total: sendResult.count ?? 0,
    metrics: {
      delivered: delivered.count ?? 0,
      opened: opened.count ?? 0,
      clicked: clicked.count ?? 0,
      unsubscribed: unsubscribed.count ?? 0,
      bounced: bounced.count ?? 0,
      complained: complained.count ?? 0,
      converted: converted.count ?? 0,
    },
    recipients: rows.map(
      (row) =>
        ({
          email: row.email,
          name: row.contact?.name ?? null,
          company: row.contact?.company ?? null,
          status: row.marketing_send_status,
          sent_at: row.sent_at,
          delivered_at: row.delivered_at,
          opened_at: row.opened_at,
          click_count: row.click_count,
          unsubscribed_at: row.unsubscribed_at,
          bounced_at: row.bounced_at,
          complained_at: row.complained_at,
          converted_lead_id: row.converted_lead_id,
        }) satisfies EmailMarketingRecipientEvent,
    ),
  }
}

/** Processes due sequence steps and a bounded recipient batch for scheduled campaigns. */
export async function processDueEmailMarketing(): Promise<{
  prepared: number
  sent: number
  skipped: number
  failed: number
}> {
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  let prepared = 0
  let sent = 0
  let skipped = 0
  let failed = 0

  const { data: dueSteps, error: dueError } = await supabase
    .from('email_marketing_sequence_steps')
    .select(
      'id, sequence_id, position, title, subject, preview_text, body_markdown, scheduled_at, sequence:email_marketing_sequences(id, list_id, name, status)',
    )
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .limit(5)
  if (dueError) throw new Error(dueError.message)

  for (const raw of (dueSteps ?? []) as unknown as {
    id: string
    sequence_id: string
    title: string
    subject: string
    body_markdown: string
    sequence: { id: string; list_id: string; name: string; status: string } | null
  }[]) {
    if (!raw.sequence || raw.sequence.status !== 'active') continue
    const { data: claimed } = await supabase
      .from('email_marketing_sequence_steps')
      .update({ status: 'sending', last_error: null })
      .eq('id', raw.id)
      .eq('status', 'scheduled')
      .select('id')
      .maybeSingle()
    if (!claimed) continue

    try {
      const { data: campaign, error: campaignError } = await supabase
        .from('lead_campaigns')
        .insert({
          name: `Email marketing · ${raw.sequence.name} · ${raw.title}`,
          subject: raw.subject,
          body_html: raw.body_markdown,
          status: 'sending',
        })
        .select('id')
        .single()
      if (campaignError || !campaign)
        throw new Error(campaignError?.message ?? 'No se pudo crear la campaña')

      const { error: linkError } = await supabase
        .from('email_marketing_sequence_steps')
        .update({ tracking_campaign_id: campaign.id })
        .eq('id', raw.id)
      if (linkError) throw new Error(linkError.message)

      const { data: members, error: membersError } = await supabase
        .from('email_marketing_list_members')
        .select('contact:email_marketing_contacts(id, email, name, company, lead_id, status)')
        .eq('list_id', raw.sequence.list_id)
      if (membersError) throw new Error(membersError.message)

      const recipients = (
        (members ?? []) as unknown as {
          contact: {
            id: string
            email: string
            name: string | null
            company: string | null
            lead_id: string | null
            status: string
          } | null
        }[]
      )
        .map((member) => member.contact)
        .filter((contact) => contact?.status === 'subscribed')
      for (let offset = 0; offset < recipients.length; offset += 250) {
        const rows = recipients.slice(offset, offset + 250).map((contact) => ({
          campaign_id: campaign.id as string,
          lead_id: contact!.lead_id,
          marketing_contact_id: contact!.id,
          sequence_step_id: raw.id,
          email: contact!.email,
          marketing_send_status: 'queued',
        }))
        const { error } = await supabase.from('lead_campaign_sends').upsert(rows, {
          onConflict: 'sequence_step_id,marketing_contact_id',
          ignoreDuplicates: true,
        })
        if (error) throw new Error(error.message)
      }
      prepared += recipients.length
    } catch (error) {
      failed += 1
      await supabase
        .from('email_marketing_sequence_steps')
        .update({
          status: 'failed',
          last_error: error instanceof Error ? error.message : 'Error desconocido',
        })
        .eq('id', raw.id)
    }
  }

  const { data: queue, error: queueError } = await supabase
    .from('lead_campaign_sends')
    .select(
      'id, campaign_id, lead_id, email, tracking_token, marketing_contact_id, sequence_step_id, marketing_contact:email_marketing_contacts(name, company, status), step:email_marketing_sequence_steps(id, title, subject, body_markdown, sequence:email_marketing_sequences(name, status))',
    )
    .eq('marketing_send_status', 'queued')
    .not('sequence_step_id', 'is', null)
    .limit(50)
  if (queueError) throw new Error(queueError.message)

  const {
    RESEND_API_KEY,
    EMAIL_MARKETING_FROM_EMAIL,
    EMAIL_MARKETING_FROM_NAME,
    EMAIL_MARKETING_REPLY_TO,
  } = (await import('@/lib/env')).serverEnv()
  if ((queue ?? []).length > 0 && !RESEND_API_KEY) {
    throw new Error('Falta configurar RESEND_API_KEY; los envíos quedan en cola.')
  }

  const { sendEmail } = await import('@/lib/email/resend')
  const { addEmailTracking } = await import('@/lib/email/tracking')
  const { markdownToHtml } = await import('@/lib/email/templates')
  const { externalAppUrl } = await import('@/lib/email/app-url')
  const { publicEnv } = await import('@/lib/env')
  const appUrl = externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL)

  for (const row of (queue ?? []) as unknown as {
    id: string
    campaign_id: string
    lead_id: string | null
    email: string
    tracking_token: string
    marketing_contact_id: string
    sequence_step_id: string
    marketing_contact: { name: string | null; company: string | null; status: string } | null
    step: {
      id: string
      title: string
      subject: string
      body_markdown: string
      sequence: { name: string; status: string } | null
    } | null
  }[]) {
    if (!row.step) continue
    if (row.step.sequence?.status !== 'active') continue
    if (row.marketing_contact?.status !== 'subscribed') {
      await supabase
        .from('lead_campaign_sends')
        .update({ marketing_send_status: 'skipped' })
        .eq('id', row.id)
        .eq('marketing_send_status', 'queued')
      skipped += 1
      continue
    }

    const { data: claim } = await supabase
      .from('lead_campaign_sends')
      .update({ marketing_send_status: 'sending', marketing_send_error: null })
      .eq('id', row.id)
      .eq('marketing_send_status', 'queued')
      .select('id')
      .maybeSingle()
    if (!claim) continue

    try {
      let html = markdownToHtml(
        row.step.body_markdown
          .replace(/\{\{\s*nombre\s*\}\}/g, row.marketing_contact?.name ?? '')
          .replace(/\{\{\s*empresa\s*\}\}/g, row.marketing_contact?.company ?? '')
          .replace(/\{\{\s*email\s*\}\}/g, row.email),
      )
      html = html.replace(/href=(["'])([^"']+)\1/gi, (match, quote: string, rawUrl: string) => {
        try {
          if (/^(#|mailto:|tel:|javascript:)/i.test(rawUrl)) return match
          const target = new URL(rawUrl, 'https://doscientos.es')
          if (target.hostname !== 'doscientos.es' && !target.hostname.endsWith('.doscientos.es'))
            return match
          target.searchParams.set('utm_source', 'email')
          target.searchParams.set('utm_medium', 'email')
          target.searchParams.set(
            'utm_campaign',
            row.step?.sequence?.name ?? row.step?.title ?? 'email',
          )
          target.searchParams.set('utm_content', row.step?.title ?? 'email')
          target.searchParams.set('utm_term', row.tracking_token)
          return `href=${quote}${target.toString()}${quote}`
        } catch {
          return match
        }
      })
      const unsubscribeUrl = `${appUrl.replace(/\/+$/, '')}/api/track/unsubscribe/${row.tracking_token}`
      html = `<p style="padding:12px;background:#f5f5f4;text-align:center;font-size:13px"><a href="${unsubscribeUrl}" style="color:#444;font-weight:600">¿No quieres recibir más emails? Date de baja aquí</a></p>${html}<hr style="border:0;border-top:1px solid #e5e7eb;margin:28px 0 16px"/><p style="font-size:12px;line-height:18px;color:#6b7280">Recibes este mensaje porque te suscribiste a las comunicaciones de Doscientos. <a href="${unsubscribeUrl}">Darte de baja</a>.</p>`
      html = addEmailTracking(html, appUrl, row.tracking_token)
      const result = await sendEmail({
        fromName: EMAIL_MARKETING_FROM_NAME,
        fromAlias: EMAIL_MARKETING_FROM_EMAIL,
        to: row.email,
        replyTo: EMAIL_MARKETING_REPLY_TO,
        subject: row.step.subject,
        html,
        tags: {
          marketing_campaign_id: row.campaign_id,
          sequence_step_id: row.step.id,
          marketing_send_id: row.id,
        },
      })
      if (result.mocked || !result.id)
        throw new Error('Resend no está configurado para el envío real.')
      await supabase
        .from('lead_campaign_sends')
        .update({
          resend_email_id: result.id,
          sent_at: new Date().toISOString(),
          marketing_send_status: 'sent',
        })
        .eq('id', row.id)
      if (row.lead_id) {
        await supabase.from('lead_interactions').insert({
          lead_id: row.lead_id,
          type: 'email_sent',
          subject: row.step.subject,
          body: html,
          resend_email_id: result.id,
          payload: {
            campaign_id: row.campaign_id,
            sequence_step_id: row.step.id,
            marketing_send_id: row.id,
          },
        })
      }
      sent += 1
    } catch (error) {
      failed += 1
      await supabase
        .from('lead_campaign_sends')
        .update({
          marketing_send_status: 'failed',
          marketing_send_error:
            error instanceof Error ? error.message.slice(0, 1000) : 'Error desconocido',
        })
        .eq('id', row.id)
    }
  }

  const { data: sendingSteps } = await supabase
    .from('email_marketing_sequence_steps')
    .select('id, tracking_campaign_id')
    .eq('status', 'sending')
    .not('tracking_campaign_id', 'is', null)
  for (const step of (sendingSteps ?? []) as { id: string; tracking_campaign_id: string }[]) {
    const { count } = await supabase
      .from('lead_campaign_sends')
      .select('id', { count: 'exact', head: true })
      .eq('sequence_step_id', step.id)
      .in('marketing_send_status', ['queued', 'sending'])
    if (count === 0) {
      const { count: failedCount } = await supabase
        .from('lead_campaign_sends')
        .select('id', { count: 'exact', head: true })
        .eq('sequence_step_id', step.id)
        .eq('marketing_send_status', 'failed')
      const terminalStatus = (failedCount ?? 0) > 0 ? 'failed' : 'sent'
      await Promise.all([
        supabase
          .from('email_marketing_sequence_steps')
          .update({
            status: terminalStatus,
            sent_at: terminalStatus === 'sent' ? new Date().toISOString() : null,
            last_error:
              terminalStatus === 'failed'
                ? `${failedCount} destinatarios no se pudieron enviar.`
                : null,
          })
          .eq('id', step.id)
          .eq('status', 'sending'),
        supabase
          .from('lead_campaigns')
          .update({ status: terminalStatus === 'failed' ? 'paused' : 'sent' })
          .eq('id', step.tracking_campaign_id),
      ])
    }
  }

  return { prepared, sent, skipped, failed }
}
