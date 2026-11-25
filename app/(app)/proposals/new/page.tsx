import type { Metadata } from 'next'

import { BackLink } from '@/components/layout/back-link'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { requireUser } from '@/lib/auth'
import { isAIEnabled } from '@/lib/env'
import { createServerClient } from '@/lib/supabase/server'

import { NewProposalForm } from './new-proposal-form'

export const metadata: Metadata = { title: 'Nueva propuesta · doscientos' }
export const dynamic = 'force-dynamic'

/**
 * Pick a lead and optionally an existing project owned by that lead.
 */
export default async function NewProposalPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string; lead_id?: string; project_id?: string }>
}) {
  await requireUser()
  const { client_id, lead_id, project_id } = await searchParams

  const supabase = await createServerClient()
  const [leadsResult, projectsResult, legacyRecipient] = await Promise.all([
    supabase.from('leads').select('id, name, company').is('deleted_at', null).order('name'),
    supabase.from('projects').select('id, name, lead_id').is('deleted_at', null).order('name'),
    !lead_id && client_id
      ? supabase.from('clients').select('lead_id').eq('id', client_id).maybeSingle()
      : null,
  ])
  const loadFailed = leadsResult.error || projectsResult.error || legacyRecipient?.error

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nueva propuesta"
        back={<BackLink href="/proposals" label="Volver a propuestas" />}
      />
      {loadFailed ? (
        <Alert variant="destructive">
          <AlertTitle>No se pudieron cargar los datos para crear la propuesta</AlertTitle>
          <AlertDescription>Actualiza la página para volver a intentarlo.</AlertDescription>
        </Alert>
      ) : (
        <NewProposalForm
          leads={
            (leadsResult.data ?? []) as Array<{
              id: string
              name: string
              company: string | null
            }>
          }
          projects={
            (projectsResult.data ?? []) as Array<{ id: string; name: string; lead_id: string }>
          }
          initialLeadId={lead_id ?? (legacyRecipient?.data?.lead_id as string | undefined)}
          initialProjectId={project_id}
          aiEnabled={isAIEnabled()}
        />
      )}
    </div>
  )
}
