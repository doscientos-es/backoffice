'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getPathValue } from '@/lib/document-templates/fields'
import type {
  DocumentGenerationContext,
  DocumentTemplate,
  DocumentTemplateField,
} from '@/lib/document-templates/types'

import { generateDocument } from '../actions'

type Props = {
  templates: DocumentTemplate[]
  context: DocumentGenerationContext
  leadId: string | null
  clientId: string | null
  projectId: string | null
}

function fieldValue(field: DocumentTemplateField, context: DocumentGenerationContext) {
  return field.source ? getPathValue(field.source, context) : ''
}

export function GenerateDocumentForm({ templates, context, leadId, clientId, projectId }: Props) {
  const router = useRouter()
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (templates[0]?.fields ?? []).map((field) => [field.name, fieldValue(field, context)]),
    ),
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const template = useMemo(
    () => templates.find((item) => item.id === templateId) ?? null,
    [templateId, templates],
  )

  function selectTemplate(id: string) {
    setTemplateId(id)
    const selected = templates.find((item) => item.id === id)
    setValues(
      Object.fromEntries(
        (selected?.fields ?? []).map((field) => [field.name, fieldValue(field, context)]),
      ),
    )
    setError(null)
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!template) return
    setPending(true)
    setError(null)
    const result = await generateDocument({ templateId, leadId, clientId, projectId, values })
    if (result.ok) router.push(`/documents/${result.attachmentId}`)
    else setError(result.error)
    setPending(false)
  }

  if (!templates.length)
    return (
      <p className="text-muted-foreground text-sm">
        No hay documentos genéricos activos. Pide a un administrador que suba el primer PDF.
      </p>
    )

  const internalFields = (template?.fields ?? []).filter((field) => field.role === 'internal')
  const recipientFields = (template?.fields ?? []).filter((field) => field.role === 'recipient')

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <label className="grid gap-1.5 text-sm font-medium">
        Documento genérico
        <select
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          value={templateId}
          onChange={(event) => selectTemplate(event.target.value)}
        >
          {templates.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {template?.description ? (
        <p className="text-muted-foreground text-sm">{template.description}</p>
      ) : null}
      {internalFields.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {internalFields.map((field) => (
            <label
              key={field.name}
              htmlFor={`document-field-${field.name}`}
              className="grid gap-1.5 text-sm font-medium"
            >
              {field.label}
              {field.required ? ' *' : ''}
              <Input
                id={`document-field-${field.name}`}
                value={values[field.name] ?? fieldValue(field, context)}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field.name]: event.target.value }))
                }
                required={field.required}
                readOnly={Boolean(field.source && fieldValue(field, context))}
              />
              {field.source ? (
                <span className="text-muted-foreground text-xs">Rellenado desde el backoffice</span>
              ) : null}
            </label>
          ))}
        </div>
      ) : null}
      {recipientFields.length > 0 ? (
        <div className="bg-secondary/50 rounded-md p-3 text-sm">
          <p className="font-medium">Campos para la otra empresa</p>
          <p className="text-muted-foreground mt-1">
            El PDF conservará estos campos rellenables:{' '}
            {recipientFields.map((field) => field.label).join(', ')}.
          </p>
        </div>
      ) : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          Los datos internos se bloquearán en el PDF; los del cliente quedarán editables.
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? 'Generando…' : 'Generar documento'}
        </Button>
      </div>
    </form>
  )
}
