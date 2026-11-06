'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { defineAction } from '@/lib/actions/define-action'
import { createServerClient } from '@/lib/supabase/server'

const PATH = '/marketing/newsletters'

function madridDateTimeToIso(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) throw new Error('Indica una fecha y hora válidas.')
  const [, y, mo, d, h, mi] = match
  const targetUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi))
  let result = targetUtc
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(result)).map((part) => [part.type, part.value]),
    )
    const represented = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
    )
    result += targetUtc - represented
  }
  const check = Object.fromEntries(
    formatter.formatToParts(new Date(result)).map((part) => [part.type, part.value]),
  )
  if (`${check.year}-${check.month}-${check.day}T${check.hour}:${check.minute}` !== value)
    throw new Error('La fecha o la hora no existe en el horario peninsular.')
  return new Date(result).toISOString()
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let value = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!
    if (char === '"' && quoted && line[index + 1] === '"') {
      value += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      cells.push(value.trim())
      value = ''
    } else {
      value += char
    }
  }
  cells.push(value.trim())
  return cells
}

function parseContactCsv(source: string): {
  email: string
  name: string | null
  company: string | null
  consentSource: string | null
  consentReference: string | null
}[] {
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length > 10001)
    throw new Error('El archivo supera los 10.000 contactos por importación.')
  if (lines.length === 0) throw new Error('Pega al menos una dirección de email.')

  const first = parseCsvLine(lines[0]!).map((cell) => cell.toLowerCase())
  const hasHeader = first.some((cell) =>
    ['email', 'correo', 'correo electrónico', 'e-mail'].includes(cell),
  )
  const emailIndex = hasHeader
    ? first.findIndex((cell) => ['email', 'correo', 'correo electrónico', 'e-mail'].includes(cell))
    : 0
  const nameIndex = hasHeader
    ? first.findIndex((cell) => ['name', 'nombre', 'contacto'].includes(cell))
    : 1
  const companyIndex = hasHeader
    ? first.findIndex((cell) => ['company', 'empresa', 'compañía'].includes(cell))
    : 2
  const consentSourceIndex = hasHeader
    ? first.findIndex((cell) =>
        ['consent_source', 'origen_permiso', 'origen del permiso'].includes(cell),
      )
    : -1
  const consentReferenceIndex = hasHeader
    ? first.findIndex((cell) =>
        ['consent_reference', 'referencia_permiso', 'evidencia'].includes(cell),
      )
    : -1
  const rows = hasHeader ? lines.slice(1) : lines
  const contacts = new Map<
    string,
    {
      email: string
      name: string | null
      company: string | null
      consentSource: string | null
      consentReference: string | null
    }
  >()

  for (const line of rows) {
    const cells = parseCsvLine(line)
    const email = (cells[emailIndex] ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue
    contacts.set(email, {
      email,
      name: nameIndex >= 0 ? cells[nameIndex]?.trim() || null : null,
      company: companyIndex >= 0 ? cells[companyIndex]?.trim() || null : null,
      consentSource: consentSourceIndex >= 0 ? cells[consentSourceIndex]?.trim() || null : null,
      consentReference:
        consentReferenceIndex >= 0 ? cells[consentReferenceIndex]?.trim() || null : null,
    })
  }
  if (contacts.size === 0)
    throw new Error('No encontré direcciones de email válidas en el contenido.')
  return [...contacts.values()]
}

export const createEmailMarketingList = defineAction({
  name: 'emailMarketing.createList',
  schema: z.object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).optional(),
  }),
  roles: ['owner', 'admin', 'member'],
  revalidate: () => [PATH],
  handler: async (input, { user }) => {
    const supabase = await createServerClient()
    const { data: duplicate } = await supabase
      .from('email_marketing_lists')
      .select('id')
      .ilike('name', input.name.replace(/[\\%_]/g, '\\$&'))
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()
    if (duplicate) throw new Error('Ya existe una lista con ese nombre.')
    const { error } = await supabase.from('email_marketing_lists').insert({
      name: input.name,
      description: input.description || null,
      created_by: user.id,
    })
    if (error) throw new Error(error.message)
  },
})

export const updateEmailMarketingList = defineAction({
  name: 'emailMarketing.updateList',
  schema: z.object({
    id: z.string().uuid(),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).optional(),
  }),
  roles: ['owner', 'admin', 'member'],
  revalidate: () => [PATH],
  handler: async ({ id, name, description }) => {
    const supabase = await createServerClient()
    const { data: duplicate, error: duplicateError } = await supabase
      .from('email_marketing_lists')
      .select('id')
      .ilike('name', name.replace(/[\\%_]/g, '\\$&'))
      .neq('id', id)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()
    if (duplicateError) throw new Error(duplicateError.message)
    if (duplicate) throw new Error('Ya existe una lista con ese nombre.')
    const { data, error } = await supabase
      .from('email_marketing_lists')
      .update({ name, description: description || null })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle()
    if (error || !data) throw new Error(error?.message ?? 'Lista no encontrada.')
  },
})

export const updateEmailMarketingContact = defineAction({
  name: 'emailMarketing.updateContact',
  schema: z.object({
    id: z.string().uuid(),
    email: z.string().trim().email('Indica un email válido.').max(320).toLowerCase(),
    name: z.string().trim().max(200).optional(),
    company: z.string().trim().max(200).optional(),
    confirmEmailConsent: z.string().optional(),
  }),
  roles: ['owner', 'admin', 'member'],
  revalidate: () => [PATH],
  handler: async ({ id, email, name, company, confirmEmailConsent }) => {
    const supabase = await createServerClient()
    const { data: contact, error: lookupError } = await supabase
      .from('email_marketing_contacts')
      .select('email, status')
      .eq('id', id)
      .maybeSingle()
    if (lookupError || !contact) throw new Error(lookupError?.message ?? 'Contacto no encontrado.')
    const emailChanged = contact.email.trim().toLowerCase() !== email
    if (emailChanged && contact.status !== 'subscribed')
      throw new Error('No se puede cambiar el email de un contacto dado de baja o bloqueado.')
    if (emailChanged && confirmEmailConsent !== 'on')
      throw new Error('Confirma que el contacto autoriza los envíos a la nueva dirección.')

    let query = supabase
      .from('email_marketing_contacts')
      .update({ name: name || null, company: company || null, ...(emailChanged ? { email } : {}) })
      .eq('id', id)
    if (emailChanged) query = query.eq('email', contact.email).eq('status', 'subscribed')
    const { data, error } = await query.select('id').maybeSingle()
    if (error?.code === '23505')
      throw new Error('Ya existe un contacto con ese email, incluso si está dado de baja.')
    if (error || !data) throw new Error(error?.message ?? 'Contacto no encontrado.')
  },
})

export const removeEmailMarketingContact = defineAction({
  name: 'emailMarketing.removeContact',
  schema: z.object({ listId: z.string().uuid(), contactId: z.string().uuid() }),
  roles: ['owner', 'admin', 'member'],
  revalidate: () => [PATH],
  handler: async ({ listId, contactId }) => {
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('email_marketing_list_members')
      .delete()
      .eq('list_id', listId)
      .eq('contact_id', contactId)
      .select('contact_id')
      .maybeSingle()
    if (error || !data) throw new Error(error?.message ?? 'Contacto no encontrado en la lista.')
  },
})

export const unsubscribeMarketingContact = defineAction({
  name: 'emailMarketing.unsubscribeContact',
  schema: z.object({ id: z.string().uuid() }),
  roles: ['owner', 'admin', 'member'],
  revalidate: () => [PATH, `${PATH}/unsubscribed`],
  handler: async ({ id }) => {
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('email_marketing_contacts')
      .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'subscribed')
      .select('id')
      .maybeSingle()
    if (error || !data)
      throw new Error(error?.message ?? 'El contacto no existe o ya está bloqueado.')
  },
})

async function addContactsToList(
  listId: string,
  contacts: ReturnType<typeof parseContactCsv>,
  consentSource: string,
) {
  const supabase = await createServerClient()
  const { data: list, error: listError } = await supabase
    .from('email_marketing_lists')
    .select('id')
    .eq('id', listId)
    .is('deleted_at', null)
    .maybeSingle()
  if (listError || !list) throw new Error(listError?.message ?? 'No se encontró la lista.')

  const now = new Date().toISOString()
  const ids = new Map<string, string>()
  const suppressed = new Set<string>()
  const contactsByEmail = new Map(contacts.map((contact) => [contact.email, contact]))
  for (let offset = 0; offset < contacts.length; offset += 500) {
    const batch = contacts.slice(offset, offset + 500)
    const emails = batch.map((contact) => contact.email)
    const { data: existing, error: existingError } = await supabase
      .from('email_marketing_contacts')
      .select('id, email, status, lead_id')
      .in('email', emails)
    if (existingError) throw new Error(existingError.message)
    const { data: matchingLeads, error: leadsError } = await supabase
      .from('leads')
      .select('id, email')
      .in('email', emails)
      .is('deleted_at', null)
    if (leadsError) throw new Error(leadsError.message)
    const leadsByEmail = new Map(
      ((matchingLeads ?? []) as { id: string; email: string | null }[])
        .filter((lead) => lead.email)
        .map((lead) => [lead.email!.toLowerCase(), lead.id]),
    )
    const known = new Set<string>()
    for (const contact of (existing ?? []) as {
      id: string
      email: string
      status: string
      lead_id: string | null
    }[]) {
      known.add(contact.email.toLowerCase())
      if (contact.status === 'subscribed') ids.set(contact.email.toLowerCase(), contact.id)
      else suppressed.add(contact.email.toLowerCase())
      const matchingLeadId = leadsByEmail.get(contact.email.toLowerCase())
      if (contact.status === 'subscribed' && !contact.lead_id && matchingLeadId) {
        const { error } = await supabase
          .from('email_marketing_contacts')
          .update({ lead_id: matchingLeadId })
          .eq('id', contact.id)
        if (error) throw new Error(error.message)
      }
    }

    const newContacts = batch.filter((contact) => !known.has(contact.email))
    if (newContacts.length) {
      const { data: inserted, error: insertError } = await supabase
        .from('email_marketing_contacts')
        .upsert(
          newContacts.map((contact) => ({
            email: contact.email,
            name: contact.name,
            company: contact.company,
            lead_id: leadsByEmail.get(contact.email) ?? null,
            status: 'subscribed',
            consented_at: now,
            consent_source: contact.consentSource || consentSource,
          })),
          { onConflict: 'email', ignoreDuplicates: true },
        )
        .select('id, email')
      if (insertError) throw new Error(insertError.message)
      for (const contact of (inserted ?? []) as {
        id: string
        email: string
      }[])
        ids.set(contact.email.toLowerCase(), contact.id)
    }
  }

  const memberRows = [...ids.entries()].map(([email, contactId]) => {
    const contact = contactsByEmail.get(email)
    return {
      list_id: listId,
      contact_id: contactId,
      consented_at: now,
      consent_source: contact?.consentSource || consentSource,
      consent_reference: contact?.consentReference ?? null,
    }
  })
  for (let offset = 0; offset < memberRows.length; offset += 500) {
    const { error } = await supabase
      .from('email_marketing_list_members')
      .upsert(memberRows.slice(offset, offset + 500), {
        onConflict: 'list_id,contact_id',
        ignoreDuplicates: true,
      })
    if (error) throw new Error(error.message)
  }
  return { addedToList: ids.size, suppressed: suppressed.size }
}

const confirmPermission = z
  .string()
  .optional()
  .refine((value) => value === 'on', 'Confirma el permiso de contacto.')

export const importEmailMarketingContacts = defineAction({
  name: 'emailMarketing.importContacts',
  schema: z.object({
    listId: z.string().uuid(),
    csv: z.string().trim().min(3).max(2_000_000),
    consentSource: z.string().trim().min(3).max(200),
  }),
  roles: ['owner', 'admin', 'member'],
  revalidate: () => [PATH],
  handler: async ({ listId, csv, consentSource }) =>
    addContactsToList(listId, parseContactCsv(csv), consentSource),
})

export const addEmailMarketingContact = defineAction({
  name: 'emailMarketing.addContact',
  schema: z.object({
    listId: z.string().uuid(),
    email: z.string().trim().email('Indica un email válido.').max(320).toLowerCase(),
    name: z.string().trim().max(200).optional(),
    company: z.string().trim().max(200).optional(),
    consentSource: z.string().trim().min(3, 'Indica el origen del permiso.').max(200),
    consentReference: z.string().trim().max(200).optional(),
    confirmPermission,
  }),
  roles: ['owner', 'admin', 'member'],
  revalidate: () => [PATH],
  handler: async ({ listId, email, name, company, consentSource, consentReference }) => {
    const result = await addContactsToList(
      listId,
      [
        {
          email,
          name: name || null,
          company: company || null,
          consentSource,
          consentReference: consentReference || null,
        },
      ],
      consentSource,
    )
    if (result.suppressed)
      throw new Error('El contacto está dado de baja o bloqueado y no se puede añadir.')
    if (!result.addedToList) throw new Error('No se pudo añadir el contacto. Inténtalo de nuevo.')
  },
})

export const createEmailMarketingSequence = defineAction({
  name: 'emailMarketing.createSequence',
  schema: z.object({
    listId: z.string().uuid(),
    name: z.string().trim().min(2).max(160),
  }),
  roles: ['owner', 'admin', 'member'],
  revalidate: () => [PATH],
  handler: async (input, { user }) => {
    const supabase = await createServerClient()
    const { data: list, error: listError } = await supabase
      .from('email_marketing_lists')
      .select('id')
      .eq('id', input.listId)
      .is('deleted_at', null)
      .maybeSingle()
    if (listError || !list) throw new Error(listError?.message ?? 'Lista no encontrada.')
    const { error } = await supabase.from('email_marketing_sequences').insert({
      list_id: input.listId,
      name: input.name,
      status: 'paused',
      created_by: user.id,
    })
    if (error) throw new Error(error.message)
  },
})

export const updateEmailMarketingSequence = defineAction({
  name: 'emailMarketing.updateSequence',
  schema: z.object({ id: z.string().uuid(), name: z.string().trim().min(2).max(160) }),
  roles: ['owner', 'admin', 'member'],
  revalidate: () => [PATH],
  handler: async ({ id, name }) => {
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('email_marketing_sequences')
      .update({ name })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle()
    if (error || !data) throw new Error(error?.message ?? 'Secuencia no encontrada.')
  },
})

export const deleteEmailMarketingSequence = defineAction({
  name: 'emailMarketing.deleteSequence',
  schema: z.object({ id: z.string().uuid() }),
  roles: ['owner', 'admin', 'member'],
  revalidate: () => [PATH],
  handler: async ({ id }) => {
    const supabase = await createServerClient()
    const { data: sequence, error: readError } = await supabase
      .from('email_marketing_sequences')
      .select('id, status')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()
    if (readError || !sequence) throw new Error(readError?.message ?? 'Secuencia no encontrada.')
    if (sequence.status === 'active') throw new Error('Pausa la secuencia antes de eliminarla.')
    const { count, error: stepsError } = await supabase
      .from('email_marketing_sequence_steps')
      .select('id', { count: 'exact', head: true })
      .eq('sequence_id', id)
      .eq('status', 'sending')
    if (stepsError) throw new Error(stepsError.message)
    if (count)
      throw new Error(
        'Hay un envío en curso. Reactiva la secuencia hasta que termine y vuelve a pausarla antes de eliminarla.',
      )
    const { data, error } = await supabase
      .from('email_marketing_sequences')
      .update({ status: 'paused', deleted_at: new Date().toISOString() })
      .eq('id', id)
      .neq('status', 'active')
      .is('deleted_at', null)
      .select('id')
      .maybeSingle()
    if (error || !data)
      throw new Error(error?.message ?? 'La secuencia ha cambiado; vuelve a intentarlo.')
  },
})

export const addEmailMarketingStep = defineAction({
  name: 'emailMarketing.addStep',
  schema: z.object({
    sequenceId: z.string().uuid(),
    title: z.string().trim().min(2).max(140),
    subject: z.string().trim().min(2).max(160),
    previewText: z.string().trim().max(220).optional(),
    bodyMarkdown: z.string().trim().min(3).max(30000),
    scheduledAt: z.string().min(16).max(16),
    sendTest: z.literal('on').optional(),
  }),
  roles: ['owner', 'admin', 'member'],
  revalidate: () => [PATH],
  handler: async (input, { user }) => {
    const scheduledAt = madridDateTimeToIso(input.scheduledAt)
    if (new Date(scheduledAt).getTime() < Date.now() + 60_000)
      throw new Error('Programa el envío al menos un minuto en el futuro.')
    const supabase = await createServerClient()
    const { data: sequence, error: sequenceError } = await supabase
      .from('email_marketing_sequences')
      .select('id, status')
      .eq('id', input.sequenceId)
      .is('deleted_at', null)
      .maybeSingle()
    if (sequenceError || !sequence)
      throw new Error(sequenceError?.message ?? 'Secuencia no encontrada.')
    if (sequence.status === 'completed')
      throw new Error('No se pueden añadir emails a una secuencia completada.')
    const { data: lastStep } = await supabase
      .from('email_marketing_sequence_steps')
      .select('position')
      .eq('sequence_id', input.sequenceId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()
    const { error } = await supabase.from('email_marketing_sequence_steps').insert({
      sequence_id: input.sequenceId,
      position: ((lastStep?.position as number | undefined) ?? 0) + 1,
      title: input.title,
      subject: input.subject,
      preview_text: input.previewText || null,
      body_markdown: input.bodyMarkdown,
      scheduled_at: scheduledAt,
      status: 'scheduled',
      created_by: user.id,
    })
    if (error) throw new Error(error.message)
    if (input.sendTest) {
      try {
        const { sendMarketingTest } = await import('@/lib/marketing/send-test')
        await sendMarketingTest(input, user)
        return { successMessage: `Email planificado; prueba enviada a ${user.email}` }
      } catch {
        return {
          warning:
            'El email está planificado, pero falló la prueba. Puedes reintentarlo desde Editar; no lo programes de nuevo.',
        }
      }
    }
  },
})

export const sendEmailMarketingTest = defineAction({
  name: 'emailMarketing.sendTest',
  schema: z.object({
    subject: z.string().trim().min(2).max(160),
    previewText: z.string().trim().max(220).optional(),
    bodyMarkdown: z.string().trim().min(3).max(30000),
  }),
  roles: ['owner', 'admin', 'member'],
  handler: async (input, { user }) => {
    const { sendMarketingTest } = await import('@/lib/marketing/send-test')
    await sendMarketingTest(input, user)
    return { email: user.email }
  },
})

export const setEmailMarketingSequenceStatus = defineAction({
  name: 'emailMarketing.setSequenceStatus',
  schema: z.object({
    id: z.string().uuid(),
    status: z.enum(['active', 'paused']),
  }),
  roles: ['owner', 'admin', 'member'],
  revalidate: () => [PATH],
  handler: async ({ id, status }) => {
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('email_marketing_sequences')
      .update({ status })
      .eq('id', id)
      .is('deleted_at', null)
      .neq('status', 'completed')
      .select('id')
      .maybeSingle()
    if (error || !data) throw new Error(error?.message ?? 'Secuencia no encontrada o completada.')
  },
})

export const sendEmailMarketingStepNow = defineAction({
  name: 'emailMarketing.sendStepNow',
  schema: z.object({ id: z.string().uuid(), confirm: z.literal(true) }),
  roles: ['owner', 'admin', 'member'],
  revalidate: () => [PATH],
  handler: async ({ id }) => {
    const supabase = await createServerClient()
    const { data: step, error } = await supabase
      .from('email_marketing_sequence_steps')
      .select(
        'id, status, tracking_campaign_id, sequence:email_marketing_sequences(status, deleted_at)',
      )
      .eq('id', id)
      .maybeSingle()
    if (error || !step) throw new Error(error?.message ?? 'Email no encontrado.')
    const sequence = step.sequence as unknown as {
      status: string
      deleted_at: string | null
    } | null
    if (!sequence || sequence.deleted_at || sequence.status !== 'active')
      throw new Error('Activa la secuencia antes de enviar este email.')
    if (step.status !== 'scheduled' || step.tracking_campaign_id)
      throw new Error('Este email ya no está pendiente de envío.')
    const env = (await import('@/lib/env')).serverEnv()
    if (!env.EMAIL_MARKETING_RESEND_API_KEY && !env.RESEND_API_KEY)
      throw new Error('Falta configurar la conexión con Resend.')
    const { data: updated, error: updateError } = await supabase
      .from('email_marketing_sequence_steps')
      .update({ scheduled_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'scheduled')
      .is('tracking_campaign_id', null)
      .select('id')
      .maybeSingle()
    if (updateError || !updated)
      throw new Error(updateError?.message ?? 'El email ya no está pendiente de envío.')
    try {
      const { processDueEmailMarketing } = await import('@/lib/marketing/email-marketing')
      const result = await processDueEmailMarketing({ stepId: id })
      return { outcome: result.failed ? ('attention' as const) : ('started' as const) }
    } catch {
      // It is already scheduled; do not encourage creating or sending a duplicate.
      return { outcome: 'queued' as const }
    }
  },
})

export const updateEmailMarketingStep = defineAction({
  name: 'emailMarketing.updateStep',
  schema: z.object({
    id: z.string().uuid(),
    title: z.string().trim().min(2).max(140),
    subject: z.string().trim().min(2).max(160),
    previewText: z.string().trim().max(220).optional(),
    bodyMarkdown: z.string().trim().min(3).max(30000),
    scheduledAt: z.string().min(16).max(16),
  }),
  roles: ['owner', 'admin', 'member'],
  revalidate: () => [PATH],
  handler: async (input) => {
    const scheduledAt = madridDateTimeToIso(input.scheduledAt)
    if (new Date(scheduledAt).getTime() < Date.now() + 60_000)
      throw new Error('Programa el envío al menos un minuto en el futuro.')
    const supabase = await createServerClient()
    const { data: step, error: readError } = await supabase
      .from('email_marketing_sequence_steps')
      .select('id, status, tracking_campaign_id')
      .eq('id', input.id)
      .maybeSingle()
    if (readError || !step) throw new Error(readError?.message ?? 'Email no encontrado.')
    if (
      step.tracking_campaign_id ||
      !['draft', 'scheduled', 'paused'].includes(step.status as string)
    )
      throw new Error('Este email ya ha entrado en la cola y no se puede editar.')
    const { data, error } = await supabase
      .from('email_marketing_sequence_steps')
      .update({
        title: input.title,
        subject: input.subject,
        preview_text: input.previewText || null,
        body_markdown: input.bodyMarkdown,
        scheduled_at: scheduledAt,
      })
      .eq('id', input.id)
      .in('status', ['draft', 'scheduled', 'paused'])
      .is('tracking_campaign_id', null)
      .select('id')
      .maybeSingle()
    if (error || !data) throw new Error(error?.message ?? 'El email ya no se puede editar.')
  },
})

export const retryEmailMarketingStep = defineAction({
  name: 'emailMarketing.retryStep',
  schema: z.object({ id: z.string().uuid() }),
  roles: ['owner', 'admin'],
  revalidate: () => [PATH],
  handler: async ({ id }) => {
    const supabase = await createServerClient()
    const { data: step, error: readError } = await supabase
      .from('email_marketing_sequence_steps')
      .select('id, status, sequence:email_marketing_sequences(status)')
      .eq('id', id)
      .maybeSingle()
    if (readError || !step) throw new Error(readError?.message ?? 'Email no encontrado.')
    const rawSequence = step.sequence as unknown as { status: string } | { status: string }[] | null
    const sequenceStatus = Array.isArray(rawSequence) ? rawSequence[0]?.status : rawSequence?.status
    if (step.status !== 'failed' || sequenceStatus !== 'active')
      throw new Error('Activa la secuencia antes de reintentar un email fallido.')
    const { error: retryError, count } = await supabase
      .from('lead_campaign_sends')
      .update({ marketing_send_status: 'queued', marketing_send_error: null }, { count: 'exact' })
      .eq('sequence_step_id', id)
      .eq('marketing_send_status', 'failed')
      .select('id')
    if (retryError) throw new Error(retryError.message)
    if (!count) throw new Error('No hay destinatarios fallidos para reintentar.')
    const { error } = await supabase
      .from('email_marketing_sequence_steps')
      .update({ status: 'sending', last_error: null })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },
})

export const deleteEmailMarketingStep = defineAction({
  name: 'emailMarketing.deleteStep',
  schema: z.object({ id: z.string().uuid() }),
  roles: ['owner', 'admin'],
  revalidate: () => [PATH],
  handler: async ({ id }) => {
    const supabase = await createServerClient()
    const { data: step, error: readError } = await supabase
      .from('email_marketing_sequence_steps')
      .select('id, status, tracking_campaign_id')
      .eq('id', id)
      .maybeSingle()
    if (readError || !step) throw new Error(readError?.message ?? 'Correo no encontrado.')
    if (
      step.tracking_campaign_id ||
      !['scheduled', 'draft', 'paused'].includes(step.status as string)
    )
      throw new Error('No se puede eliminar un correo que ya ha entrado en envío.')
    const { data, error } = await supabase
      .from('email_marketing_sequence_steps')
      .delete()
      .eq('id', id)
      .in('status', ['draft', 'scheduled', 'paused'])
      .is('tracking_campaign_id', null)
      .select('id')
      .maybeSingle()
    if (error || !data) throw new Error(error?.message ?? 'El email ya no se puede eliminar.')
  },
})

export const deleteEmailMarketingList = defineAction({
  name: 'emailMarketing.deleteList',
  schema: z.object({ id: z.string().uuid() }),
  roles: ['owner', 'admin', 'member'],
  revalidate: () => [PATH],
  handler: async ({ id }) => {
    const supabase = await createServerClient()
    const { count, error: sequencesError } = await supabase
      .from('email_marketing_sequences')
      .select('id', { count: 'exact', head: true })
      .eq('list_id', id)
      .is('deleted_at', null)
    if (sequencesError) throw new Error(sequencesError.message)
    if (count)
      throw new Error('Esta lista tiene secuencias asociadas. Elimínalas o usa otra lista.')
    const { error } = await supabase
      .from('email_marketing_lists')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
    if (error) throw new Error(error.message)
  },
})

export async function addEmailMarketingStepForm(formData: FormData): Promise<void> {
  const result = await addEmailMarketingStep(formData)
  if (!result.ok) throw new Error(result.error)
  revalidatePath(PATH)
}

export async function setEmailMarketingSequenceStatusForm(formData: FormData): Promise<void> {
  const result = await setEmailMarketingSequenceStatus(formData)
  if (!result.ok) throw new Error(result.error)
  revalidatePath(PATH)
}

export async function deleteEmailMarketingStepForm(formData: FormData): Promise<void> {
  const result = await deleteEmailMarketingStep(formData)
  if (!result.ok) throw new Error(result.error)
  revalidatePath(PATH)
}

export async function updateEmailMarketingStepForm(formData: FormData): Promise<void> {
  const result = await updateEmailMarketingStep(formData)
  if (!result.ok) throw new Error(result.error)
  revalidatePath(PATH)
}

export async function retryEmailMarketingStepForm(formData: FormData): Promise<void> {
  const result = await retryEmailMarketingStep(formData)
  if (!result.ok) throw new Error(result.error)
  revalidatePath(PATH)
}
