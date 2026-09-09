'use client'

import { FileText, LoaderCircle as Loader2, Paperclip, X } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import type { ExpenseInvoiceSuggestion } from '@/lib/finance/invoice-extraction'

export type InvoiceExtractionMeta = {
  source: 'ai' | 'rules'
  warning: string | null
}

interface Props {
  /** Fired once the PDF is stored as an (orphan) attachment, and on removal. */
  onAttached: (invoice: { id: string; name: string } | null) => void
  /** Fired when extraction succeeds; the parent applies the data to the form. */
  onExtracted: (suggestion: ExpenseInvoiceSuggestion, meta: InvoiceExtractionMeta) => void
  /** Lets the parent block submit while an upload/extraction is in flight. */
  onPendingChange: (pending: boolean) => void
}

type Phase = 'idle' | 'uploading' | 'extracting' | 'done'

/**
 * PDF picker for the new-expense form: uploads the invoice as an orphan
 * attachment (linked to the expense on create) and asks the server to extract
 * its data so the form can be pre-filled.
 */
export function ExpenseInvoiceUpload({ onAttached, onExtracted, onPendingChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [fileName, setFileName] = useState<string | null>(null)
  const [meta, setMeta] = useState<InvoiceExtractionMeta | null>(null)
  const [extractFailed, setExtractFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const busy = phase === 'uploading' || phase === 'extracting'

  async function handleFile(file: File) {
    setError(null)
    setMeta(null)
    setExtractFailed(false)
    setPhase('uploading')
    onPendingChange(true)
    try {
      const formData = new FormData()
      formData.set('file', file)
      const uploadRes = await fetch('/api/attachments/upload', { method: 'POST', body: formData })
      const uploadJson = (await uploadRes.json()) as { id?: string; error?: string }
      if (!uploadRes.ok || !uploadJson.id) {
        throw new Error(uploadJson.error ?? 'No se pudo subir la factura')
      }

      setFileName(file.name)
      onAttached({ id: uploadJson.id, name: file.name })

      setPhase('extracting')
      const extractRes = await fetch('/api/expenses/extract-invoice', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ attachment_id: uploadJson.id }),
      })
      const extractJson = (await extractRes.json()) as {
        suggestion?: ExpenseInvoiceSuggestion
        source?: 'ai' | 'rules'
        warning?: string | null
        error?: string
      }
      if (extractRes.ok && extractJson.suggestion) {
        const m: InvoiceExtractionMeta = {
          source: extractJson.source ?? 'rules',
          warning: extractJson.warning ?? null,
        }
        setMeta(m)
        onExtracted(extractJson.suggestion, m)
      } else {
        // Non-blocking: the PDF stays attached and the form can be filled by hand.
        setExtractFailed(true)
      }
      setPhase('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
      setFileName(null)
      onAttached(null)
      setPhase('idle')
    } finally {
      onPendingChange(false)
    }
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = ''
    setFileName(null)
    setMeta(null)
    setExtractFailed(false)
    setError(null)
    setPhase('idle')
    onAttached(null)
  }

  return (
    <div className="border-border bg-muted/20 flex flex-col gap-2 rounded-lg border border-dashed p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="sr-only"
          aria-label="Factura en PDF"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Paperclip className="size-3.5" />
          )}
          {phase === 'uploading'
            ? 'Subiendo…'
            : phase === 'extracting'
              ? 'Analizando…'
              : fileName
                ? 'Cambiar factura'
                : 'Adjuntar factura (PDF)'}
        </Button>
        {fileName ? (
          <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm">
            <FileText className="size-3.5 shrink-0" />
            <span className="max-w-64 truncate">{fileName}</span>
          </span>
        ) : null}
        {phase === 'done' ? (
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            <X className="size-3.5" />
            Quitar
          </Button>
        ) : null}
      </div>
      {phase === 'idle' && !fileName ? (
        <p className="text-muted-foreground text-xs">
          Sube la factura en PDF y rellenaremos el formulario con sus datos. Quedará adjunta al
          gasto al crearlo.
        </p>
      ) : null}
      {meta ? (
        <p className="text-muted-foreground text-xs">
          {meta.source === 'ai'
            ? 'Datos aplicados con IA. Revísalos antes de crear el gasto.'
            : 'Datos aplicados con reglas locales. Revísalos antes de crear el gasto.'}
        </p>
      ) : null}
      {meta?.warning ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">{meta.warning}</p>
      ) : null}
      {extractFailed ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          No se pudieron extraer datos de la factura. El PDF quedará adjunto al gasto.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}
