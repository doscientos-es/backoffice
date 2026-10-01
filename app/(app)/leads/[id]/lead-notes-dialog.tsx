'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@doscientos/ui'
import { FileText, Maximize2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'

export function LeadNotesDialog({ notes }: { notes: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Ver nota completa"
          title="Ver nota completa"
        >
          <Maximize2 className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            Notas del lead
          </DialogTitle>
          <DialogDescription>
            Información interna completa. El formato original se conserva.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-border bg-muted/20 p-4">
          <p className="text-sm leading-7 whitespace-pre-wrap text-foreground">{notes}</p>
        </div>
        <div className="flex justify-end">
          <CopyButton text={notes} label="Copiar notas" className="size-8" />
        </div>
      </DialogContent>
    </Dialog>
  )
}
