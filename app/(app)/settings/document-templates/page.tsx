import { FileText } from 'lucide-react'
import type { Metadata } from 'next'

import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requirePageRole } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

import { TemplateUploadForm } from './template-upload-form'

export const metadata: Metadata = { title: 'Plantillas de documentos · doscientos' }
export const dynamic = 'force-dynamic'

export default async function DocumentTemplatesPage() {
  await requirePageRole(['owner', 'admin'])
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('document_templates')
    .select('id, name, slug, description, fields, version, is_active, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Plantillas de documentos"
        description="Sube PDFs rellenables y úsalos desde cualquier cliente o proyecto, sin editar texto en el backoffice."
        icon={<FileText className="size-5" />}
      />
      <Card>
        <CardHeader>
          <CardTitle>Subir plantilla PDF</CardTitle>
        </CardHeader>
        <CardContent>
          <TemplateUploadForm />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Plantillas disponibles</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <p className="text-destructive text-sm">{error.message}</p> : null}
          {!data?.length && !error ? (
            <p className="text-muted-foreground text-sm">
              Todavía no hay plantillas. Empieza por un NDA.
            </p>
          ) : (
            <div className="divide-border divide-y">
              {(data ?? []).map((template) => {
                const fields = Array.isArray(template.fields) ? template.fields : []
                return (
                  <div
                    key={template.id as string}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium">{template.name as string}</p>
                      <p className="text-muted-foreground text-xs">
                        {template.slug as string} · {fields.length} campos · v
                        {template.version as number}
                      </p>
                    </div>
                    <Badge variant={template.is_active ? 'success' : 'neutral'}>
                      {template.is_active ? 'Activa' : 'Archivada'}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
