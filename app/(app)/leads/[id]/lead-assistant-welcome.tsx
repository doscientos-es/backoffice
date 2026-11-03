'use client'

import { ArrowUpRight, FileText, Mail, Sparkles, Wallet } from 'lucide-react'

import { Button } from '@/components/ui/button'

const SUGGESTIONS = [
  {
    title: 'Ponerme al día',
    description: 'Necesidades, acuerdos y pendientes',
    question: '¿Qué quería este lead y qué quedó pendiente?',
    icon: Sparkles,
  },
  {
    title: 'Presupuesto y plazos',
    description: 'Lo que sabemos, sin suposiciones',
    question: '¿Qué sabemos de su presupuesto y sus plazos?',
    icon: Wallet,
  },
  {
    title: 'Retomar el contacto',
    description: 'Un email con el contexto adecuado',
    question: 'Prepara un email para retomar el contacto con lo que sabemos.',
    icon: Mail,
  },
  {
    title: 'Preparar una propuesta',
    description: 'Un borrador a partir de lo acordado',
    question: 'Prepara un borrador de propuesta con el alcance confirmado y señala lo pendiente.',
    icon: FileText,
  },
]

export function LeadAssistantWelcome({ onSelect }: { onSelect: (question: string) => void }) {
  return (
    <section aria-label="Empieza una consulta" className="space-y-7 py-2 sm:py-6">
      <div className="max-w-sm space-y-4">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 text-primary">
          <Sparkles className="size-6" aria-hidden />
        </div>
        <div className="space-y-3">
          <h3 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Retoma el hilo.
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Recupera lo importante del historial y prepara tu siguiente conversación. ¿Por dónde
            empezamos?
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {SUGGESTIONS.map(({ title, description, question, icon: Icon }) => (
          <Button
            key={title}
            type="button"
            variant="outline"
            className="h-auto min-w-0 items-start justify-start rounded-xl border-border/70 bg-card p-3 text-left whitespace-normal shadow-xs hover:border-primary/30 motion-reduce:transform-none motion-reduce:transition-none sm:p-4"
            onClick={() => onSelect(question)}
          >
            <span className="flex w-full min-w-0 flex-col gap-4">
              <span className="flex items-center justify-between gap-2">
                <Icon className="size-4 text-primary" aria-hidden />
                <ArrowUpRight className="size-3.5 text-muted-foreground" aria-hidden />
              </span>
              <span className="space-y-1">
                <span className="block text-sm font-medium text-foreground">{title}</span>
                <span className="block text-xs leading-5 font-normal text-muted-foreground">
                  {description}
                </span>
              </span>
            </span>
          </Button>
        ))}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Puedes preguntar por una reunión antigua, un acuerdo o un detalle concreto.
      </p>
    </section>
  )
}
