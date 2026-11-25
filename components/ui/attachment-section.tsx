'use client'

import {
  Button as MenuButton,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
} from '@doscientos/ui'
import {
  Camera,
  Download,
  Ellipsis,
  ExternalLink,
  Eye,
  FileText,
  LoaderCircle as Loader2,
  Trash2,
  Upload as UploadCloud,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FormRow } from '@/components/ui/form-row'
import { Input } from '@/components/ui/input'
import { canPreviewAttachment } from '@/lib/attachments/preview'
import { cn } from '@/lib/utils'

import { AttachmentPreviewDialog } from './attachment-preview-dialog'
import { useAttachmentUploads } from './use-attachment-uploads'

export type AttachmentItem = {
  id: string
  name: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
  source?: 'storage' | 'drive' | null
  web_view_link?: string | null
}

type EntityType = 'lead' | 'project' | 'proposal' | 'client' | 'expense'

interface Props {
  entityType: EntityType
  entityId: string
  attachments: AttachmentItem[]
  canEdit: boolean
  title?: string
}

const ACCEPTED = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg'

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1_048_576) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / 1_048_576).toFixed(1)} MB`
}

function attachmentType(attachment: AttachmentItem): string {
  if (attachment.source === 'drive') return 'Google Drive'
  const extension = attachment.name.match(/\.([a-z0-9]{1,8})$/i)?.[1]
  return extension ? extension.toUpperCase() : attachment.mime_type || 'Archivo'
}

/** Official Google Drive product mark. It is only resized, as permitted by Google. */
function GoogleDriveIcon() {
  return (
    <svg viewBox="0 0 87.3 78" className="size-4" aria-hidden="true" focusable="false">
      <path
        d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
        fill="#0066da"
      />
      <path
        d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z"
        fill="#00ac47"
      />
      <path
        d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
        fill="#ea4335"
      />
      <path
        d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"
        fill="#00832d"
      />
      <path
        d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
        fill="#2684fc"
      />
      <path
        d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
        fill="#ffba00"
      />
    </svg>
  )
}

export function AttachmentSection({
  entityType,
  entityId,
  attachments,
  canEdit,
  title = 'Adjuntos',
}: Props) {
  const router = useRouter()
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // Tracks nested dragenter/dragleave so the drop highlight doesn't flicker over children.
  const dragDepth = useRef(0)
  const {
    uploading,
    progress,
    entries: uploads,
    add: addUploads,
    retry: retryUpload,
    dismiss: dismissUpload,
  } = useAttachmentUploads(entityType, entityId, () => router.refresh())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingAll, setDeletingAll] = useState(false)
  const [deleteAllTargets, setDeleteAllTargets] = useState<AttachmentItem[] | null>(null)
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set())
  const [errors, setErrors] = useState<string[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [driveDialogOpen, setDriveDialogOpen] = useState(false)
  const [driveUrl, setDriveUrl] = useState('')
  const [driveLinking, setDriveLinking] = useState(false)
  const [driveError, setDriveError] = useState<string | null>(null)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const visibleAttachments = attachments.filter((attachment) => !removedIds.has(attachment.id))
  const storedAttachments = visibleAttachments.filter((attachment) => attachment.source !== 'drive')
  const hasDriveAttachments = visibleAttachments.some((attachment) => attachment.source === 'drive')
  const showFilters = visibleAttachments.length >= 10 || search !== '' || filter !== 'all'
  const driveDeleteCount =
    deleteAllTargets?.filter((attachment) => attachment.source === 'drive').length ?? 0
  const storedDeleteCount = (deleteAllTargets?.length ?? 0) - driveDeleteCount
  const filteredAttachments = visibleAttachments.filter((attachment) => {
    const matchesSearch = attachment.name
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase())
    const matchesFilter =
      filter === 'all' ||
      (filter === 'drive' && attachment.source === 'drive') ||
      (filter === 'pdf' &&
        attachment.source !== 'drive' &&
        attachment.mime_type === 'application/pdf') ||
      (filter === 'image' &&
        attachment.source !== 'drive' &&
        attachment.mime_type?.startsWith('image/')) ||
      (filter === 'other' &&
        attachment.source !== 'drive' &&
        attachment.mime_type !== 'application/pdf' &&
        !attachment.mime_type?.startsWith('image/'))
    return matchesSearch && matchesFilter
  })

  // Keep successful removals hidden until the server has reflected them in its props.
  useEffect(() => {
    if (deletingId || deletingAll) return
    const serverIds = new Set(attachments.map((attachment) => attachment.id))
    setRemovedIds((current) => {
      const remaining = new Set([...current].filter((id) => serverIds.has(id)))
      return remaining.size === current.size ? current : remaining
    })
  }, [attachments, deletingId, deletingAll])

  function hideAttachments(ids: string[]) {
    setRemovedIds((current) => new Set([...current, ...ids]))
  }

  function restoreAttachment(id: string) {
    setRemovedIds((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })
  }

  async function downloadAll() {
    if (downloadingAll || deletingAll || storedAttachments.length === 0) return
    setErrors([])
    setDownloadingAll(true)
    try {
      const response = await fetch('/api/attachments/download-all', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: storedAttachments.map((attachment) => attachment.id) }),
      })
      if (!response.ok) {
        const result = (await response.json()) as { error?: string }
        throw new Error(result.error ?? 'No se pudieron descargar los adjuntos')
      }
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = 'adjuntos.zip'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'No se pudieron descargar los adjuntos'])
    } finally {
      setDownloadingAll(false)
    }
  }

  function uploadFiles(files: File[]) {
    if (files.length === 0 || uploading || deletingAll) return
    dragDepth.current = 0
    setDragActive(false)
    setErrors([])
    addUploads(files)
    if (fileRef.current) fileRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    void uploadFiles(e.target.files ? Array.from(e.target.files) : [])
  }

  function handleDragEnter(e: React.DragEvent) {
    if (!canEdit || uploading || deletingAll) return
    e.preventDefault()
    dragDepth.current += 1
    setDragActive(true)
  }

  function handleDragOver(e: React.DragEvent) {
    if (!canEdit) return
    e.preventDefault()
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!canEdit) return
    e.preventDefault()
    dragDepth.current -= 1
    if (dragDepth.current <= 0) {
      dragDepth.current = 0
      setDragActive(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    if (!canEdit) return
    e.preventDefault()
    dragDepth.current = 0
    setDragActive(false)
    if (uploading || deletingAll) return
    void uploadFiles(e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [])
  }

  function openDriveDialog() {
    setDriveUrl('')
    setDriveError(null)
    setDriveDialogOpen(true)
  }

  /** Links an existing Drive file as a reference attachment (no copy is made). */
  async function submitDriveLink(e: React.FormEvent) {
    e.preventDefault()
    if (driveLinking || deletingAll) return

    setDriveLinking(true)
    setDriveError(null)
    try {
      const res = await fetch('/api/attachments/drive-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ drive_url: driveUrl, entityType, entityId }),
      })
      const json = (await res.json()) as { id?: string; error?: string }

      if (!res.ok || !json.id) {
        setDriveError(json.error ?? 'Error al vincular el documento')
        return
      }

      setDriveDialogOpen(false)
      setDriveUrl('')
      router.refresh()
    } catch {
      setDriveError('Error de red')
    } finally {
      setDriveLinking(false)
    }
  }

  async function deleteAttachment(attachment: AttachmentItem): Promise<string | null> {
    try {
      const res = await fetch(`/api/attachments/${attachment.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        return json.error ?? 'No se pudo eliminar el adjunto'
      }
      return null
    } catch {
      return 'Error de red al eliminar el adjunto'
    }
  }

  async function removeAttachment(attachment: AttachmentItem) {
    if (!canEdit || uploading || deletingId || deletingAll) return
    const note =
      attachment.source === 'drive'
        ? ' Solo se quitará el enlace; el archivo original de Drive no se eliminará.'
        : ' El archivo subido se eliminará y esta acción no se puede deshacer.'
    const sharedNote =
      entityType === 'lead' || entityType === 'client'
        ? ' Si está compartido, también desaparecerá de la oportunidad o cliente vinculado.'
        : ''
    const confirmationMessage = `¿Eliminar «${attachment.name}»?${note}${sharedNote}`
    if (!window.confirm(confirmationMessage)) return

    setErrors([])
    setDeletingId(attachment.id)
    hideAttachments([attachment.id])
    try {
      const error = await deleteAttachment(attachment)
      if (error) {
        restoreAttachment(attachment.id)
        setErrors([error])
      }
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  async function removeAllAttachments() {
    if (!canEdit || !deleteAllTargets?.length || uploading || deletingId || deletingAll) return
    setErrors([])
    setDeletingAll(true)
    setDeleteAllTargets(null)
    hideAttachments(deleteAllTargets.map((attachment) => attachment.id))
    const failures: string[] = []
    try {
      for (const attachment of deleteAllTargets) {
        const error = await deleteAttachment(attachment)
        if (error) {
          restoreAttachment(attachment.id)
          failures.push(`${attachment.name}: ${error}`)
        }
      }
      if (failures.length) setErrors(['No se pudieron eliminar todos los adjuntos:', ...failures])
    } finally {
      setDeletingAll(false)
      router.refresh()
    }
  }

  return (
    <Card
      className={cn('relative', dragActive && 'ring-2 ring-primary ring-offset-2')}
      onDragEnter={canEdit ? handleDragEnter : undefined}
      onDragOver={canEdit ? handleDragOver : undefined}
      onDragLeave={canEdit ? handleDragLeave : undefined}
      onDrop={canEdit ? handleDrop : undefined}
    >
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <CardTitle className="min-w-0 truncate">{title}</CardTitle>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
            {visibleAttachments.length}
          </span>
        </div>
        {canEdit && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED}
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading || deletingAll}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading || deletingAll}
            />
          </>
        )}
        <div className="flex shrink-0 items-center gap-1">
          {canEdit && (
            <>
              <IconButton
                type="button"
                variant="ghost"
                size="icon-sm"
                label="Hacer foto"
                disabled={uploading || deletingAll}
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="size-3.5" />
              </IconButton>
              <IconButton
                type="button"
                variant="ghost"
                size="icon-sm"
                label="Vincular desde Google Drive"
                disabled={deletingAll}
                onClick={openDriveDialog}
              >
                <GoogleDriveIcon />
              </IconButton>
            </>
          )}
          {(storedAttachments.length > 0 || (canEdit && visibleAttachments.length > 0)) && (
            <DropdownMenuTrigger>
              <MenuButton
                variant="ghost"
                size="icon-sm"
                aria-label="Más acciones de adjuntos"
                isDisabled={
                  uploading || deletingId !== null || deletingAll || driveLinking || downloadingAll
                }
              >
                {deletingAll || downloadingAll ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Ellipsis className="size-4" />
                )}
              </MenuButton>
              <DropdownMenuContent placement="bottom end">
                {storedAttachments.length > 0 && (
                  <DropdownMenuItem onAction={() => void downloadAll()}>
                    <Download aria-hidden />
                    Descargar todos los adjuntos
                  </DropdownMenuItem>
                )}
                {canEdit && (
                  <DropdownMenuItem
                    variant="destructive"
                    onAction={() => setDeleteAllTargets([...visibleAttachments])}
                  >
                    <Trash2 aria-hidden />
                    Eliminar todos los adjuntos
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenuTrigger>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-4 sm:px-6">
        {canEdit && (
          <button
            type="button"
            aria-label="Añadir archivos"
            disabled={uploading || deletingAll}
            onClick={() => fileRef.current?.click()}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-wait disabled:opacity-60',
              dragActive && 'border-primary bg-primary/5',
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background text-primary">
              {uploading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <UploadCloud className="size-4" aria-hidden />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">
                {uploading
                  ? `Subiendo ${progress?.done ?? 0}/${progress?.total ?? 0}…`
                  : dragActive
                    ? 'Suelta los archivos para adjuntarlos'
                    : 'Arrastra archivos aquí'}
              </span>
              {!uploading && (
                <span className="block text-xs text-muted-foreground">
                  o pulsa para seleccionar uno o varios
                </span>
              )}
            </span>
          </button>
        )}
        {uploading && (
          <p role="status" className="sr-only">
            Subiendo {progress?.done ?? 0} de {progress?.total ?? 0} archivos
          </p>
        )}
        {uploads.length > 0 && (
          <ul aria-label="Estado de las subidas" className="space-y-2">
            {uploads.map((entry) => (
              <li key={entry.id} className="rounded-lg border p-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium" title={entry.file.name}>
                    {entry.file.name}
                  </span>
                  {entry.status === 'error' ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploading || deletingAll}
                        onClick={() => retryUpload(entry)}
                      >
                        Reintentar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Descartar error de ${entry.file.name}`}
                        onClick={() => dismissUpload(entry.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {entry.status === 'queued' ? 'En espera' : `${entry.percent}%`}
                    </span>
                  )}
                </div>
                {entry.status === 'error' ? (
                  <p role="alert" className="mt-1 text-xs text-destructive">
                    {entry.error}
                  </p>
                ) : (
                  <progress
                    className="mt-1 w-full"
                    aria-label={`Progreso de ${entry.file.name}`}
                    value={entry.percent}
                    max={100}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        {(deletingAll || deletingId) && (
          <p role="status" className="text-sm text-muted-foreground">
            {deletingAll ? 'Eliminando adjuntos…' : 'Eliminando adjunto…'}
          </p>
        )}
        {downloadingAll && (
          <p role="status" className="text-sm text-muted-foreground">
            Preparando descarga…
          </p>
        )}
        {storedAttachments.length > 0 && hasDriveAttachments && (
          <p className="text-xs text-muted-foreground">
            Los enlaces de Google Drive no se incluyen; ábrelos desde Drive.
          </p>
        )}
        {errors.length > 0 && (
          <ul className="space-y-0.5">
            {errors.map((msg) => (
              <li key={msg} className="text-sm font-medium text-destructive">
                {msg}
              </li>
            ))}
          </ul>
        )}
        {showFilters && (
          <div className="flex flex-wrap gap-2">
            <Input
              aria-label="Buscar adjuntos"
              placeholder="Buscar adjuntos"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-w-40 flex-1"
            />
            <select
              aria-label="Filtrar adjuntos por tipo"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="border-input rounded-md border bg-background px-3 text-sm"
            >
              <option value="all">Todos los tipos</option>
              <option value="pdf">PDF</option>
              <option value="image">Imágenes</option>
              <option value="drive">Google Drive</option>
              <option value="other">Otros archivos</option>
            </select>
          </div>
        )}
        {visibleAttachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin adjuntos.</p>
        ) : filteredAttachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay adjuntos que coincidan con los filtros.
          </p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-2">
            {filteredAttachments.map((a) => (
              <li
                key={a.id}
                className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/20 px-2.5 py-2"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
                  {a.source === 'drive' ? (
                    <GoogleDriveIcon />
                  ) : (
                    <FileText className="size-4" aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={a.name}>
                    {a.name}
                  </p>
                  <p
                    className="truncate text-xs text-muted-foreground"
                    title={a.mime_type || attachmentType(a)}
                  >
                    {attachmentType(a)}
                    {a.size_bytes ? ` · ${formatSize(a.size_bytes)}` : ''}
                  </p>
                </div>
                {a.source === 'drive' ? (
                  a.web_view_link && (
                    <Button asChild variant="ghost" size="icon" className="size-7 shrink-0">
                      <Link
                        href={a.web_view_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir en Drive"
                      >
                        <ExternalLink className="size-3.5" />
                        <span className="sr-only">Abrir en Drive</span>
                      </Link>
                    </Button>
                  )
                ) : (
                  <>
                    {canPreviewAttachment(a.mime_type) ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        aria-label={`Ver ${a.name}`}
                        title={`Ver ${a.name}`}
                        onClick={() => setPreviewAttachment(a)}
                      >
                        <Eye className="size-3.5" />
                      </Button>
                    ) : null}
                    <Button asChild variant="ghost" size="icon" className="size-7 shrink-0">
                      <a href={`/api/documents/${a.id}/download`} title={`Descargar ${a.name}`}>
                        <Download className="size-3.5" />
                        <span className="sr-only">Descargar {a.name}</span>
                      </a>
                    </Button>
                  </>
                )}
                {canEdit ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    aria-label={`Eliminar adjunto ${a.name}`}
                    title="Eliminar adjunto"
                    disabled={uploading || deletingId !== null || deletingAll}
                    onClick={() => void removeAttachment(a)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <ConfirmDialog
        open={deleteAllTargets !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteAllTargets(null)
        }}
        title="¿Eliminar todos los adjuntos?"
        description={`Se quitarán ${storedDeleteCount} ${storedDeleteCount === 1 ? 'archivo subido' : 'archivos subidos'} y ${driveDeleteCount} ${driveDeleteCount === 1 ? 'enlace' : 'enlaces'} de Google Drive. Se intentará eliminar los archivos subidos; esta acción no se puede deshacer.${entityType === 'lead' || entityType === 'client' ? ' La lista puede incluir adjuntos compartidos entre la oportunidad y el cliente.' : ''}${driveDeleteCount ? ' Los archivos originales de Google Drive no se eliminarán; solo se quitarán sus enlaces.' : ''}`}
        confirmLabel={deletingAll ? 'Eliminando…' : 'Eliminar todos'}
        destructive
        pending={deletingAll}
        onConfirm={() => void removeAllAttachments()}
      />
      <Dialog open={driveDialogOpen} onOpenChange={setDriveDialogOpen}>
        <DialogContent>
          <form onSubmit={submitDriveLink}>
            <DialogHeader>
              <DialogTitle>Vincular documento de Drive</DialogTitle>
              <DialogDescription>
                Pega el enlace de un Google Doc, Sheet o carpeta. Se guardará solo una referencia:
                el original sigue editándose en Drive.
              </DialogDescription>
            </DialogHeader>
            <FormRow label="Enlace de Drive" htmlFor="drive-url" error={driveError} required>
              <Input
                id="drive-url"
                type="url"
                placeholder="https://docs.google.com/document/d/…"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                disabled={driveLinking}
                required
              />
            </FormRow>
            <DialogFooter>
              <Button type="submit" disabled={driveLinking || !driveUrl}>
                {driveLinking ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Vinculando…
                  </>
                ) : (
                  'Vincular'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {previewAttachment && (
        <AttachmentPreviewDialog
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
    </Card>
  )
}
