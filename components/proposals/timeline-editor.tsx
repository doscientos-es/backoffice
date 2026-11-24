'use client'

import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { nextTimelineWeek, type TimelineItem } from '@/lib/proposals/timeline'

export function TimelineEditor({
  items,
  onChange,
  locked,
}: {
  items: TimelineItem[]
  onChange: (items: TimelineItem[]) => void
  locked: boolean
}) {
  function update(index: number, patch: Partial<TimelineItem>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }
  const nextWeek = nextTimelineWeek(items.at(-1)?.end_date ?? '')
  return (
    <section
      id="proposal-timeline"
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5"
      tabIndex={-1}
    >
      <header>
        <h2 className="text-base font-semibold">
          Plazos del proyecto <span className="text-muted-foreground">· Opcional</span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Añade hitos, fases o semanas con fechas concretas. El cliente podrá guardarlos en su
          calendario.
        </p>
      </header>
      {items.map((item, index) => (
        <div key={item.id} className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-2">
            <strong className="text-sm">Hito {index + 1}</strong>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={locked}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              aria-label={`Eliminar hito ${index + 1}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <label htmlFor={`timeline-${item.id}-title`} className="grid gap-1 text-sm">
            Qué haremos
            <Input
              id={`timeline-${item.id}-title`}
              value={item.title}
              maxLength={120}
              disabled={locked}
              onChange={(event) => update(index, { title: event.target.value })}
              placeholder="Ej. Semana 1 · Diseño"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label htmlFor={`timeline-${item.id}-start`} className="grid gap-1 text-sm">
              Inicio
              <Input
                id={`timeline-${item.id}-start`}
                type="date"
                value={item.start_date}
                disabled={locked}
                onChange={(event) => update(index, { start_date: event.target.value })}
              />
            </label>
            <label htmlFor={`timeline-${item.id}-end`} className="grid gap-1 text-sm">
              Fin (incluido)
              <Input
                id={`timeline-${item.id}-end`}
                type="date"
                value={item.end_date}
                disabled={locked}
                onChange={(event) => update(index, { end_date: event.target.value })}
              />
            </label>
          </div>
          <label htmlFor={`timeline-${item.id}-description`} className="grid gap-1 text-sm">
            Detalle <span className="text-xs text-muted-foreground">Opcional</span>
            <Textarea
              id={`timeline-${item.id}-description`}
              value={item.description}
              maxLength={500}
              rows={2}
              disabled={locked}
              onChange={(event) => update(index, { description: event.target.value })}
              placeholder="Qué entregaremos o revisaremos"
            />
          </label>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="self-start"
        disabled={locked || items.length >= 60}
        onClick={() =>
          onChange([
            ...items,
            { id: crypto.randomUUID(), title: '', description: '', start_date: '', end_date: '' },
          ])
        }
      >
        <Plus className="size-4" /> Añadir hito o semana
      </Button>
      {nextWeek ? (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={locked || items.length >= 60}
          onClick={() =>
            onChange([
              ...items,
              { id: crypto.randomUUID(), title: '', description: '', ...nextWeek },
            ])
          }
        >
          <Plus className="size-4" /> Añadir semana siguiente
        </Button>
      ) : null}
    </section>
  )
}
