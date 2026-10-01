'use client'

import { Button as PopoverButton, PopoverContent, PopoverTrigger } from '@doscientos/ui'
import { Bookmark, Save, Trash2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import type { SavedViewsConfig } from './list-controls'

type SavedView = { id: string; name: string; filters: Record<string, string> }

function readSavedViews(storageKey: string): SavedView[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.flatMap((item): SavedView[] => {
      if (!item || typeof item !== 'object') return []
      const value = item as Record<string, unknown>
      if (typeof value.id !== 'string' || typeof value.name !== 'string') return []
      const filters = value.filters
      if (!filters || typeof filters !== 'object' || Array.isArray(filters)) return []
      return [
        {
          id: value.id,
          name: value.name.slice(0, 60),
          filters: Object.fromEntries(
            Object.entries(filters).filter(
              ([key, filterValue]) => typeof key === 'string' && typeof filterValue === 'string',
            ),
          ),
        },
      ]
    })
  } catch {
    return []
  }
}

function writeSavedViews(storageKey: string, views: SavedView[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(views))
  } catch {
    // Saved views remain optional if browser storage is unavailable.
  }
}

function SavedViewsMenu({
  views,
  hasActiveFilters,
  saving,
  name,
  onStartSaving,
  onCancelSaving,
  onNameChange,
  onSave,
  onApply,
  onDelete,
}: {
  views: SavedView[]
  hasActiveFilters: boolean
  saving: boolean
  name: string
  onStartSaving: () => void
  onCancelSaving: () => void
  onNameChange: (name: string) => void
  onSave: () => void
  onApply: (view: SavedView) => void
  onDelete: (id: string) => void
}) {
  return (
    <PopoverTrigger>
      <PopoverButton type="button" size="sm" variant="outline" className="h-9 shrink-0">
        <Bookmark className="size-3.5" />
        Vistas
        {views.length > 0 ? (
          <span className="rounded-full bg-muted px-1.5 py-px text-[10px] leading-4 text-muted-foreground">
            {views.length}
          </span>
        ) : null}
      </PopoverButton>
      <PopoverContent placement="bottom start" className="w-[min(22rem,calc(100vw-2rem))] p-3">
        <div className="mb-3">
          <p className="text-sm font-semibold">Vistas guardadas</p>
          <p className="text-xs text-muted-foreground">Se guardan solo en este navegador.</p>
        </div>
        {views.length > 0 ? (
          <div className="mb-3 space-y-1">
            {views.map((view) => (
              <div key={view.id} className="flex items-center gap-1 rounded-md hover:bg-muted/60">
                <button
                  type="button"
                  onClick={() => onApply(view)}
                  className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {view.name}
                </button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => onDelete(view.id)}
                  aria-label={`Eliminar vista ${view.name}`}
                  title={`Eliminar ${view.name}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-3 rounded-md bg-muted/50 px-2 py-3 text-xs text-muted-foreground">
            Guarda un conjunto de filtros para recuperarlo con un clic.
          </p>
        )}
        {saving ? (
          <div className="flex gap-2">
            <Input
              autoFocus
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onSave()
                if (event.key === 'Escape') onCancelSaving()
              }}
              aria-label="Nombre de la vista"
              placeholder="Ej. Mis leads calientes"
              maxLength={60}
              className="h-9"
            />
            <Button type="button" size="sm" onClick={onSave} disabled={!name.trim()}>
              Guardar
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full"
            onClick={onStartSaving}
            disabled={!hasActiveFilters}
            title={hasActiveFilters ? undefined : 'Aplica algún filtro antes de guardar una vista'}
          >
            <Save className="size-3.5" />
            Guardar filtros actuales
          </Button>
        )}
      </PopoverContent>
    </PopoverTrigger>
  )
}

export function SavedViewsControl({
  config: savedViewsConfig,
  searchKey,
  onSearchChange: setQ,
  hasActiveFilters,
  navigate,
}: {
  config: SavedViewsConfig
  searchKey: string
  onSearchChange: (value: string) => void
  hasActiveFilters: boolean
  navigate: (params: URLSearchParams) => void
}) {
  const params = useSearchParams()
  const { storageKey } = savedViewsConfig
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [isSavingView, setIsSavingView] = useState(false)
  const [savedViewName, setSavedViewName] = useState('')
  useEffect(() => {
    setSavedViews(readSavedViews(storageKey))
    setIsSavingView(false)
    setSavedViewName('')
  }, [storageKey])

  const applySavedView = useCallback(
    (view: SavedView) => {
      if (!savedViewsConfig) return
      const next = new URLSearchParams(params.toString())
      for (const key of savedViewsConfig.filterKeys) next.delete(key)
      for (const [key, value] of Object.entries(view.filters)) next.set(key, value)
      next.delete('page')
      setQ(view.filters[searchKey] ?? '')
      navigate(next)
    },
    [navigate, params, savedViewsConfig, searchKey, setQ],
  )

  const saveCurrentView = useCallback(() => {
    if (!savedViewsConfig) return
    const name = savedViewName.trim()
    if (!name) return
    const filters: Record<string, string> = {}
    for (const key of savedViewsConfig.filterKeys) {
      const value = params.get(key)
      if (value) filters[key] = value
    }
    if (Object.keys(filters).length === 0) return
    const id = globalThis.crypto?.randomUUID?.() ?? `view-${Date.now()}`
    setSavedViews((current) => {
      const next = [...current, { id, name: name.slice(0, 60), filters }]
      writeSavedViews(savedViewsConfig.storageKey, next)
      return next
    })
    setSavedViewName('')
    setIsSavingView(false)
  }, [params, savedViewName, savedViewsConfig])

  const deleteSavedView = useCallback(
    (id: string) => {
      if (!savedViewsConfig) return
      setSavedViews((current) => {
        const next = current.filter((view) => view.id !== id)
        writeSavedViews(savedViewsConfig.storageKey, next)
        return next
      })
    },
    [savedViewsConfig],
  )

  return (
    <SavedViewsMenu
      views={savedViews}
      hasActiveFilters={hasActiveFilters}
      saving={isSavingView}
      name={savedViewName}
      onStartSaving={() => setIsSavingView(true)}
      onCancelSaving={() => {
        setSavedViewName('')
        setIsSavingView(false)
      }}
      onNameChange={setSavedViewName}
      onSave={saveCurrentView}
      onApply={applySavedView}
      onDelete={deleteSavedView}
    />
  )
}
