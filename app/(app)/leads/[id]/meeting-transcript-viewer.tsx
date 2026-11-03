'use client'

import { Search } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'

import { Input } from '@/components/ui/input'

const MAX_RENDERED_LINES = 400

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Splits `text` so that every case-insensitive match of `query` is marked. */
function highlight(text: string, query: string) {
  const needle = query.trim()
  if (!needle) return text
  const parts = text.split(new RegExp(`(${escapeRegExp(needle)})`, 'gi'))
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: parts are positional and never reordered
      <mark key={index} className="rounded-sm bg-warning/30 px-0.5 text-foreground">
        {part}
      </mark>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: parts are positional and never reordered
      <Fragment key={index}>{part}</Fragment>
    ),
  )
}

/** Transcript as readable lines with a search box that filters and highlights matches. */
export function MeetingTranscriptViewer({ transcript }: { transcript: string }) {
  const [query, setQuery] = useState('')
  const lines = useMemo(
    () =>
      transcript
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    [transcript],
  )
  const needle = query.trim().toLowerCase()
  const matches = needle ? lines.filter((line) => line.toLowerCase().includes(needle)) : lines
  const shown = matches.slice(0, MAX_RENDERED_LINES)

  return (
    <div className="rounded-lg border border-border/70">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar en la transcripción"
          aria-label="Buscar en la transcripción"
          className="h-7 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums" aria-live="polite">
          {needle ? `${matches.length} de ${lines.length}` : `${lines.length} líneas`}
        </span>
      </div>
      <div className="max-h-[50vh] overflow-auto p-3">
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin resultados para «{query.trim()}».</p>
        ) : (
          <ul className="space-y-1.5 text-sm leading-6">
            {shown.map((line, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: lines are static text and may repeat
              <li key={index}>{highlight(line, query)}</li>
            ))}
          </ul>
        )}
        {matches.length > shown.length ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Mostrando las primeras {MAX_RENDERED_LINES} líneas. Afina la búsqueda para ver el resto.
          </p>
        ) : null}
      </div>
    </div>
  )
}
