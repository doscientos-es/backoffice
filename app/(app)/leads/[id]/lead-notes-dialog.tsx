"use client";

import { FileTextIcon as FileText, ArrowsOut as Maximize2 } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function LeadNotesDialog({ notes }: { notes: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs">
          <Maximize2 className="size-3.5" />
          Ver nota completa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
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
          <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">{notes}</p>
        </div>
        <div className="flex justify-end">
          <CopyButton text={notes} label="Copiar notas" className="size-8" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
