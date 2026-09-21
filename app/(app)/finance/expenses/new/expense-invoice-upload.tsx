'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@doscientos/ui'
import { Check, FileText, LoaderCircle as Loader2, Paperclip, Sparkles, X } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import type { ExpenseInvoiceSuggestion } from '@/lib/finance/invoice-extraction'

export type InvoiceExtractionMeta = {
  source: 'ai' | 'rules'
  warning: string | null
}

type LargeFileReview = {
  reason: string
  sizeBytes: number
  pageCount: number | null
}

interface Props {
  /** Fired once the PDF is stored as an (orphan) attachment, and on removal. */
  onAttached: (invoice: { id: string; name: string } | null) => void
  /** Fired when extraction succeeds; the parent applies the data to the form. */
  onExtracted: (suggestion: ExpenseInvoiceSuggestion, meta: InvoiceExtractionMeta) => void
  /** Lets the parent block submit while an upload/extraction is in flight. */
  onPendingChange: (pending: boolean) => void
  onReviewChange: (reviewed: boolean) => void
}

type Phase = 'idle' | 'uploading' | 'extracting' | 'done'

const EXTRACTION_TIMEOUT_MS = 45_000

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
export function ExpenseInvoiceUpload({ onAttached, onExtracted, onPendingChange, onReviewChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [attachmentId, setAttachmentId] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [meta, setMeta] = useState<InvoiceExtractionMeta | null>(null)
  const [extractFailed, setExtractFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<ExpenseInvoiceSuggestion | null>(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [largeFileReview, setLargeFileReview] = useState<LargeFileReview | null>(null)

  const busy = phase === 'uploading' || phase === 'extracting'

  async function extractAttachment(attachmentId: string, confirmLarge = false) {
    setPhase('extracting')
    setScanOpen(true)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), EXTRACTION_TIMEOUT_MS)

    try {
      const extractRes = await fetch('/api/expenses/extract-invoice', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ attachment_id: attachmentId, confirm_large: confirmLarge }),
        signal: controller.signal,
      })
      const extractJson = await readJson<{
        suggestion?: ExpenseInvoiceSuggestion
        source?: 'ai' | 'rules'
        warning?: string | null
        error?: string
        requires_confirmation?: boolean
        reason?: string
        size_bytes?: number
        page_count?: number | null
      }>(extractRes)

      if (extractRes.status === 409 && extractJson.requires_confirmation) {
        setScanOpen(false)
        setLargeFileReview({
          reason: extractJson.reason ?? 'Este documento puede tener un coste de análisis elevado.',
          sizeBytes: extractJson.size_bytes ?? 0,
          pageCount: extractJson.page_count ?? null,
        })
        return
      }

      if (extractRes.ok && extractJson.suggestion) {
        const extractionMeta: InvoiceExtractionMeta = {
          source: extractJson.source ?? 'rules',
          warning: extractJson.warning ?? null,
        }
        setMeta(extractionMeta)
        setSuggestion(extractJson.suggestion)
        onReviewChange(false)
        setScanOpen(true)
      } else {
        setScanOpen(false)
        setExtractFailed(true)
        if (extractJson.error) setError(extractJson.error)
      }
    } catch (err) {
      setScanOpen(false)
      setExtractFailed(true)
      setError(
        err instanceof Error && err.name === 'AbortError'
          ? 'El análisis está tardando demasiado. La factura queda adjunta y puedes rellenar el gasto a mano.'
          : err instanceof Error
            ? err.message
            : 'No se pudo analizar la factura. La factura queda adjunta y puedes rellenar el gasto a mano.',
      )
    } finally {
      clearTimeout(timeoutId)
      setPhase('done')
    }
  }

  async function handleFile(file: File) {
    setError(null)
    setMeta(null)
    setExtractFailed(false)
    setSuggestion(null)
    onReviewChange(false)
    setLargeFileReview(null)
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
      setAttachmentId(uploadJson.id)
      onAttached({ id: uploadJson.id, name: file.name })

      await extractAttachment(uploadJson.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
      setScanOpen(false)
      setFileName(null)
      setAttachmentId(null)
      onAttached(null)
      setPhase('idle')
    } finally {
      onPendingChange(false)
    }
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = ''
    setFileName(null)
    setAttachmentId(null)
    setMeta(null)
    setExtractFailed(false)
    setError(null)
    setSuggestion(null)
    onReviewChange(false)
    setLargeFileReview(null)
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
            Sube la factura en PDF o como foto y rellenaremos el formulario con sus datos. Quedará
            adjunta al gasto al crearlo.
          </p>
        ) : null}
        {meta ? (
          <p className="text-muted-foreground text-xs">
            {meta.source === 'ai'
              ? 'Datos aplicados con IA. Revísalos antes de crear el gasto.'
              : 'Datos aplicados con reglas locales. Revísalos antes de crear el gasto.'}
          </p>
        ) : null}
        {suggestion || extractFailed ? (
          <label className="border-border bg-background flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              onChange={(event) => onReviewChange(event.target.checked)}
            />
            <span>
              {suggestion
                ? 'He revisado los datos rellenados y el formulario completo antes de crear el gasto.'
                : 'He revisado el formulario completo y la factura adjunta antes de crear el gasto.'}
            </span>
          </label>
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
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="text-primary size-5" />
              {suggestion ? 'Factura analizada' : 'Analizando factura'}
            </DialogTitle>
            <DialogDescription>
              {suggestion
                ? 'He encontrado datos que puedo importar al nuevo gasto. Revisa el resultado antes de aceptarlo.'
                : 'Estoy leyendo proveedor, fecha e importes.'}
            </DialogDescription>
          </DialogHeader>
          {!suggestion ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <Loader2 className="text-primary size-10 animate-spin" />
              <p className="font-medium">Escaneando factura…</p>
              <p className="text-muted-foreground text-sm">
                Estoy leyendo proveedor, fecha e importes.
              </p>
            </div>
          ) : (
            <div className="bg-muted/40 grid gap-2 rounded-lg p-4 text-sm">
              {suggestion.vendor && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Proveedor</span>
                  <span className="font-medium">{suggestion.vendor}</span>
                </div>
              )}
              {suggestion.invoice_reference && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Factura</span>
                  <span>{suggestion.invoice_reference}</span>
                </div>
              )}
              {suggestion.expense_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha</span>
                  <span>{suggestion.expense_date}</span>
                </div>
              )}
              {suggestion.subtotal !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base imponible</span>
                  <span>{suggestion.subtotal} €</span>
                </div>
              )}
              {suggestion.tax_rate !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IVA</span>
                  <span>{suggestion.tax_rate} %</span>
                </div>
              )}
              {suggestion.total !== null && (
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">Total factura</span>
                  <span>{suggestion.total} €</span>
                </div>
              )}
              {suggestion.due_date && (
                <div className="flex justify-between"><span className="text-muted-foreground">Vencimiento</span><span>{suggestion.due_date}</span></div>
              )}
              {suggestion.vendor_nif && (
                <div className="flex justify-between"><span className="text-muted-foreground">NIF</span><span>{suggestion.vendor_nif}</span></div>
              )}
              <div className="text-muted-foreground border-border mt-2 border-t pt-2 text-xs">
                Confianza de lectura: {Math.round(suggestion.confidence * 100)} %. Comprueba también categoría, pago, proyecto y moneda.
              </div>
              {suggestion.subtotal !== null && suggestion.tax_rate !== null && suggestion.total !== null &&
                Math.abs(suggestion.subtotal * (1 + suggestion.tax_rate / 100) - suggestion.total) > 0.02 ? (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  La base, el IVA y el total no cuadran exactamente. Revisa los importes antes de importar.
                </p>
              ) : null}
            </div>
          )}
          {suggestion ? (
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setScanOpen(false)}>
                Rellenar a mano
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (suggestion)
                    onExtracted(suggestion, {
                      source: meta?.source ?? 'rules',
                      warning: meta?.warning ?? null,
                    })
                  setScanOpen(false)
                }}
              >
                <Check className="size-4" /> Importar datos
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={largeFileReview !== null}
        onOpenChange={(open) => {
          if (!open) setLargeFileReview(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Documento de análisis costoso</DialogTitle>
            <DialogDescription>
              {largeFileReview?.reason} El archivo seguirá adjunto y no se analizará con IA hasta
              que lo confirmes.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/40 rounded-lg p-3 text-sm">
            {largeFileReview?.pageCount ? `${largeFileReview.pageCount} páginas · ` : ''}
            {largeFileReview ? `${(largeFileReview.sizeBytes / 1024 / 1024).toFixed(1)} MB` : ''}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLargeFileReview(null)}>
              Rellenar a mano
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!attachmentId) return
                setLargeFileReview(null)
                onPendingChange(true)
                void extractAttachment(attachmentId, true)
                  .catch((err) => {
                    setError(
                      err instanceof Error ? err.message : 'No se pudo analizar el documento',
                    )
                    setScanOpen(false)
                    setPhase('done')
                  })
                  .finally(() => onPendingChange(false))
              }}
              disabled={!attachmentId || busy}
            >
              Analizar igualmente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
