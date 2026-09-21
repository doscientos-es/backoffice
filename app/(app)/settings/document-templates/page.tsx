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
        title="Documentos genéricos"
        description="Sube PDFs rellenables reutilizables y genéralos desde un lead, cliente o proyecto."
        icon={<FileText className="size-5" />}
      />
      <Card>
        <CardHeader>
          <CardTitle>Subir PDF rellenable</CardTitle>
        </CardHeader>
        <CardContent>
          <>
            <p className="text-muted-foreground mb-4 text-sm">
              El PDF debe tener campos de formulario AcroForm. Los campos con nombres conocidos se
              rellenarán automáticamente con los datos de la empresa y del lead; los demás quedarán
              editables en el PDF generado.
            </p>
            <TemplateUploadForm />
          </>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Documentos disponibles</CardTitle>
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
