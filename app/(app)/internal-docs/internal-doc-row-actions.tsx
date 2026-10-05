'use client'

import { Dialog, DialogDescription, DialogHeader, DialogTitle, DocPreview } from '@doscientos/ui'
import { Download, Eye } from 'lucide-react'

import { Button } from '@/components/ui/button'

type InternalDocRowActionsProps = {
  id: string
  mimeType: string | null
  name: string
  previewUrl: string | null
}

export function InternalDocRowActions({
  id,
  mimeType,
  name,
  previewUrl,
}: InternalDocRowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button asChild size="icon-sm" variant="ghost">
        <a
          href={`/api/internal-docs/${encodeURIComponent(id)}/download`}
          download
          aria-label={`Descargar ${name}`}
          title="Descargar documento"
        >
          <Download aria-hidden="true" />
        </a>
      </Button>
      <Dialog
        trigger={
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={`Vista previa ${name}`}
            title="Vista previa"
          >
            <Eye aria-hidden="true" />
          </Button>
        }
        className="w-full max-w-5xl gap-3 sm:max-w-5xl"
      >
        <DialogHeader className="pr-8">
          <DialogTitle className="truncate">{name}</DialogTitle>
          <DialogDescription>Vista previa del documento</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-auto rounded-md border">
          <DocPreview url={previewUrl} mimeType={mimeType} name={name} />
        </div>
      </Dialog>
    </div>
  )
}
