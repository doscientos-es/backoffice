import { notFound } from 'next/navigation'

import { BackLink } from '@/components/layout/back-link'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { requireUser } from '@/lib/auth'
import type {
  DocumentGenerationContext,
  DocumentTemplate,
  DocumentTemplateField,
} from '@/lib/document-templates/types'
import { createServerClient } from '@/lib/supabase/server'

import { GenerateDocumentForm } from './generate-document-form'

export const dynamic = 'force-dynamic'

function row(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

export default async function GenerateDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string; project_id?: string }>
}) {
  await requireUser()
  const { client_id: clientId, project_id: projectId } = await searchParams
  if (!clientId && !projectId) notFound()

  const supabase = await createServerClient()
  const [{ data: client }, { data: project }, { data: company }, { data: templateRows }] =
    await Promise.all([
      clientId
        ? supabase
            .from('clients')
            .select(
              'id, name, nif, email, phone, contact_person, billing_address_street, billing_address_zip, billing_address_city, billing_address_province, billing_address_country',
            )
            .eq('id', clientId)
            .is('deleted_at', null)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      projectId
        ? supabase
            .from('projects')
            .select('id, name, client_id')
            .eq('id', projectId)
            .is('deleted_at', null)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('settings')
        .select(
          'company_name, company_nif, company_address, company_address_street, company_address_zip, company_address_city, company_address_province, company_address_country',
        )
        .eq('id', 1)
        .maybeSingle(),
      supabase
        .from('document_templates')
        .select(
          'id, name, slug, description, fields, storage_path, mime_type, size_bytes, version, is_active, created_at',
        )
        .is('deleted_at', null)
        .eq('is_active', true)
        .order('name'),
    ])
  if (!client && !project) notFound()

  const resolvedClient =
    client ??
    (project?.client_id
      ? (
          await supabase
            .from('clients')
            .select(
              'id, name, nif, email, phone, contact_person, billing_address_street, billing_address_zip, billing_address_city, billing_address_province, billing_address_country',
            )
            .eq('id', project.client_id)
            .is('deleted_at', null)
            .maybeSingle()
        ).data
      : null)
  const context: DocumentGenerationContext = {
    client: row(resolvedClient),
    project: row(project),
    company: row(company),
  }
  const templates = (templateRows ?? []).map((template) => ({
    ...(template as unknown as DocumentTemplate),
    size_bytes: Number(template.size_bytes ?? 0),
    fields: (Array.isArray(template.fields) ? template.fields : []) as DocumentTemplateField[],
  }))
  const subject = context.client?.name ?? context.project?.name ?? 'documento'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Crear documento"
        description={`Genera un PDF rellenable para ${String(subject)}.`}
        back={
          <BackLink
            href={clientId ? `/clients/${clientId}` : `/projects/${projectId}`}
            label="Volver"
          />
        }
      />
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <GenerateDocumentForm
            templates={templates}
            context={context}
            clientId={clientId ?? (project?.client_id as string | null) ?? null}
            projectId={projectId ?? null}
          />
        </CardContent>
      </Card>
    </div>
  )
}
