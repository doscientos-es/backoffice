'use client'

import { Check, FileText, LoaderCircle as Loader2, Paperclip, Sparkles, X } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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

async function readJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error(
      response.ok
        ? 'El servidor devolvió una respuesta no válida'
        : `Error del servidor (${response.status})`,
    )
  }
  return (await response.json()) as T
}

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
  const [suggestion, setSuggestion] = useState<ExpenseInvoiceSuggestion | null>(null)
  const [scanOpen, setScanOpen] = useState(false)

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
      const uploadJson = await readJson<{ id?: string; error?: string }>(uploadRes)
      if (!uploadRes.ok || !uploadJson.id) {
        throw new Error(uploadJson.error ?? 'No se pudo subir la factura')
      }

      setFileName(file.name)
      onAttached({ id: uploadJson.id, name: file.name })

      setPhase('extracting')
      setScanOpen(true)
      const extractRes = await fetch('/api/expenses/extract-invoice', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ attachment_id: uploadJson.id }),
      })
      const extractJson = await readJson<{
        suggestion?: ExpenseInvoiceSuggestion
        source?: 'ai' | 'rules'
        warning?: string | null
        error?: string
      }>(extractRes)
      if (extractRes.ok && extractJson.suggestion) {
        const m: InvoiceExtractionMeta = {
          source: extractJson.source ?? 'rules',
          warning: extractJson.warning ?? null,
        }
        setMeta(m)
        setSuggestion(extractJson.suggestion)
        setScanOpen(true)
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
    setSuggestion(null)
    setScanOpen(false)
    setPhase('idle')
    onAttached(null)
  }

  return (
    <>
    <div className="border-border bg-muted/20 flex flex-col gap-2 rounded-lg border border-dashed p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label="Factura en PDF o foto"
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
                : 'Adjuntar factura (PDF o foto)'}
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
          Sube la factura en PDF o como foto y rellenaremos el formulario con sus datos. Quedará adjunta al
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
    <Dialog open={scanOpen} onOpenChange={setScanOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="text-primary size-5" /> Factura analizada</DialogTitle>
          <DialogDescription>He encontrado datos que puedo importar al nuevo gasto. Revisa el resultado antes de aceptarlo.</DialogDescription>
        </DialogHeader>
        {!suggestion ? <div className="flex flex-col items-center gap-4 py-8 text-center"><Loader2 className="text-primary size-10 animate-spin" /><p className="font-medium">Escaneando factura…</p><p className="text-muted-foreground text-sm">Estoy leyendo proveedor, fecha e importes.</p></div> : <div className="bg-muted/40 grid gap-2 rounded-lg p-4 text-sm">
          {suggestion.vendor && <div className="flex justify-between"><span className="text-muted-foreground">Proveedor</span><span className="font-medium">{suggestion.vendor}</span></div>}
          {suggestion.invoice_reference && <div className="flex justify-between"><span className="text-muted-foreground">Factura</span><span>{suggestion.invoice_reference}</span></div>}
          {suggestion.expense_date && <div className="flex justify-between"><span className="text-muted-foreground">Fecha</span><span>{suggestion.expense_date}</span></div>}
          {suggestion.subtotal !== null && <div className="flex justify-between"><span className="text-muted-foreground">Base imponible</span><span>{suggestion.subtotal} €</span></div>}
        </div>}
        {suggestion ? <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setScanOpen(false)}>Rellenar a mano</Button>
          <Button type="button" onClick={() => { if (suggestion) onExtracted(suggestion, { source: meta?.source ?? 'rules', warning: meta?.warning ?? null }); setScanOpen(false) }}><Check className="size-4" /> Importar datos</Button>
        </DialogFooter> : null}
      </DialogContent>
    </Dialog>
    </>
  )
}
