import { FileText } from 'lucide-react'

export function LeadNotesIndicator({ notes }: { notes: string | null | undefined }) {
  if (!notes?.trim()) return null

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
      title="Este lead dejó una nota; abre su ficha para leerla."
    >
      <FileText className="size-3" aria-hidden="true" />
      Nota
    </span>
  )
}
