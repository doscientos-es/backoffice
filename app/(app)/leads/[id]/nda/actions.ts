'use server'

import { z } from 'zod'

import { defineAction } from '@/lib/actions/define-action'
import { createServerClient } from '@/lib/supabase/server'

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || null)

const CreateNdaInput = z.object({
  leadId: z.string().uuid(),
  counterpartyName: z.string().trim().min(2, 'Indica el nombre de la empresa o persona').max(160),
  counterpartyNif: optionalText(32),
  counterpartyAddress: optionalText(300),
  representativeName: optionalText(120),
  purpose: z.string().trim().min(5, 'Describe la finalidad del acuerdo').max(500),
  confidentialityYears: z.coerce.number().int().min(1).max(10),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida'),
})

export const createNda = defineAction<typeof CreateNdaInput, { token: string }>({
  name: 'leads.nda.create',
  schema: CreateNdaInput,
  roles: ['owner', 'admin', 'member'],
  revalidate: (_payload, input) => [`/leads/${input.leadId}/nda`],
  handler: async (input, { user }) => {
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('lead_ndas')
      .insert({
        lead_id: input.leadId,
        counterparty_name: input.counterpartyName,
        counterparty_nif: input.counterpartyNif,
        counterparty_address: input.counterpartyAddress,
        representative_name: input.representativeName,
        purpose: input.purpose,
        confidentiality_years: input.confidentialityYears,
        effective_date: input.effectiveDate,
        created_by: user.id,
      })
      .select('portal_token')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'No se pudo crear el NDA')
    return { token: data.portal_token as string }
  },
})

const VoidNdaInput = z.object({ id: z.string().uuid(), leadId: z.string().uuid() })

/** Voids a pending NDA so its public link stops working. Signed NDAs stay. */
export const voidNda = defineAction({
  name: 'leads.nda.void',
  schema: VoidNdaInput,
  roles: ['owner', 'admin', 'member'],
  revalidate: (_payload, input) => [`/leads/${input.leadId}/nda`],
  handler: async (input) => {
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('lead_ndas')
      .update({ status: 'void' })
      .eq('id', input.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Solo se pueden anular NDAs pendientes de firma')
  },
})
