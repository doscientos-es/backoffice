'use server'

import { z } from 'zod'

import { defineAction } from '@/lib/actions/define-action'
import { createServerClient } from '@/lib/supabase/server'

export const loadMeetingArtifact = defineAction({
  name: 'leads.loadMeetingArtifact',
  schema: z.object({
    leadId: z.string().uuid(),
    interactionId: z.string().uuid(),
    kind: z.enum(['transcript', 'notes']),
  }),
  handler: async ({ leadId, interactionId, kind }) => {
    // Use the user's session, never the admin client: RLS enforces access to this lead.
    const supabase = await createServerClient()
    const column = kind === 'transcript' ? 'transcript_text' : 'notes_text'
    const { data, error } = await supabase
      .from('lead_interaction_artifacts')
      .select(`${column}, transcript_truncated`)
      .eq('interaction_id', interactionId)
      .eq('lead_id', leadId)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Documento no disponible o sin permisos para leerlo.')
    const text = 'transcript_text' in data ? data.transcript_text : data.notes_text
    return {
      text: typeof text === 'string' ? text : '',
      truncated: kind === 'transcript' && data.transcript_truncated === true,
    }
  },
})
