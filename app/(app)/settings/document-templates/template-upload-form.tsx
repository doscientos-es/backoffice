'use client'

import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type UploadedField = { name: string; label: string; role: string; source: string | null }

export function TemplateUploadForm() {
  const ref = useRef<HTMLFormElement>(null)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [fields, setFields] = useState<UploadedField[]>([])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    setFields([])
    try {
      const response = await fetch('/api/document-templates/upload', {
        method: 'POST',
        body: new FormData(event.currentTarget),
      })
      const result = (await response.json()) as { error?: string; fields?: UploadedField[] }
      if (!response.ok) throw new Error(result.error ?? 'No se pudo subir la plantilla')
      setMessage('Plantilla subida correctamente. Los campos se han detectado automáticamente.')
      setFields(result.fields ?? [])
      ref.current?.reset()
      window.location.reload()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo subir la plantilla')
    } finally {
      setPending(false)
    }
  }

  return (
    <form ref={ref} onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Input name="name" placeholder="Acuerdo de confidencialidad" required aria-label="Nombre" />
      <Input
        name="slug"
        placeholder="nda"
        required
        aria-label="Identificador"
        pattern="[a-z0-9_-]+"
      />
      <Input
        name="description"
        placeholder="Descripción opcional"
        aria-label="Descripción"
        className="sm:col-span-2"
      />
      <Input
        name="file"
        type="file"
        accept="application/pdf,.pdf"
        required
        aria-label="PDF de plantilla"
        className="sm:col-span-2"
      />
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Subiendo…' : 'Subir PDF'}
        </Button>
        {message ? <p className="text-muted-foreground text-sm">{message}</p> : null}
      </div>
      {fields.length > 0 ? (
        <div className="text-muted-foreground text-xs sm:col-span-2">
          Campos detectados: {fields.map((field) => field.name).join(', ')}
        </div>
      ) : null}
    </form>
  )
}
