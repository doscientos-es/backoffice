'use client'

import { ArrowRight, Download, Plus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { ListColumnHeader } from './list-column-header'
import { exportToCSV, rowLabel } from './list-csv'
import type { BulkAction, ListPageProps } from './list-page'
import { startNavProgress } from './nav-progress'

function hasTextSelection(): boolean {
  const selection = window.getSelection()
  return !!selection && !selection.isCollapsed && selection.toString().trim().length > 0
}

type ListTableProps<Data, Key extends string> = Pick<
  ListPageProps<Data, Key>,
  | 'columns'
  | 'rows'
  | 'mobileRow'
  | 'onRowClick'
  | 'addHref'
  | 'addLabel'
  | 'bulkActions'
  | 'exportFilename'
>

export function ListTable<Data, Key extends string>({
  columns,
  rows,
  mobileRow,
  onRowClick,
  addHref,
  addLabel,
  bulkActions = [],
  exportFilename,
}: ListTableProps<Data, Key>) {
  const router = useRouter()
  const prefetched = useRef(new Set<string>())
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [runningBulkAction, setRunningBulkAction] = useState<string | null>(null)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const prefetchRow = (href?: string) => {
    if (!href || prefetched.current.has(href)) return
    prefetched.current.add(href)
    router.prefetch(href)
  }
  const openRow = (row: ListPageProps<Data, Key>['rows'][number], newTab: boolean) => {
    if (onRowClick) {
      onRowClick(row)
      return
    }
    if (!row.href) return
    if (newTab) {
      window.open(row.href, '_blank', 'noopener')
      return
    }
    startNavProgress(row.href)
    router.push(row.href)
  }
  // Drop selections that are no longer present (filters, pagination, deletions).
  useEffect(() => {
    const ids = new Set(rows.map((row) => row.id))
    setSelectedIds((current) => {
      const next = current.filter((id) => ids.has(id))
      return next.length === current.length ? current : next
    })
  }, [rows])

  const visibleIds = rows.map((row) => row.id)
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds.includes(id)).length
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length

  function toggleVisibleSelection(checked: boolean) {
    setBulkError(null)
    setSelectedIds((current) => {
      if (checked) return [...new Set([...current, ...visibleIds])]
      return current.filter((id) => !visibleIds.includes(id))
    })
  }

  async function runBulkAction(action: BulkAction) {
    if (selectedIds.length === 0 || runningBulkAction) return
    setRunningBulkAction(action.label)
    setBulkError(null)
    try {
      await action.onAction(selectedIds)
      setSelectedIds([])
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : 'No se pudo completar la acción')
    } finally {
      setRunningBulkAction(null)
    }
  }

  function exportSelectedRows() {
    const selectedRows = rows.filter((row) => selectedIds.includes(row.id))
    if (selectedRows.length === 0) return
    exportToCSV(columns, selectedRows, `${exportFilename ?? 'seleccionadas'}-seleccionadas`)
  }

  const hasRowActions = rows.some((row) => row.rowActions != null)
  return (
    <>
      {bulkActions.length > 0 && selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-primary/[0.04] px-4 py-2.5">
          <span className="text-sm font-medium">{selectedIds.length} seleccionadas</span>
          {bulkActions.map((action) => {
            const Icon = action.icon
            return (
              <Button
                key={action.label}
                size="sm"
                variant={action.variant ?? 'outline'}
                disabled={runningBulkAction !== null}
                onClick={() => void runBulkAction(action)}
              >
                {Icon ? <Icon className="mr-1.5 size-3.5" /> : null}
                {runningBulkAction === action.label ? 'Aplicando…' : action.label}
              </Button>
            )
          })}
          {exportFilename ? (
            <Button size="sm" variant="outline" onClick={exportSelectedRows}>
              <Download className="mr-1.5 size-3.5" />
              Exportar seleccionadas
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
            Cancelar
          </Button>
          {bulkError ? <span className="text-xs text-destructive">{bulkError}</span> : null}
        </div>
      ) : null}

      {mobileRow ? (
        <div className="flex flex-col gap-2 p-3 sm:hidden">
          {rows.map((row) => (
            <div key={row.id}>{mobileRow(row)}</div>
          ))}
          {addHref ? (
            <Link
              href={addHref}
              className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
            >
              <Plus className="size-4 shrink-0" />
              {addLabel ?? 'Añadir nuevo'}
            </Link>
          ) : null}
        </div>
      ) : null}
      <div className={cn('overflow-x-auto', mobileRow && 'hidden sm:block')}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {bulkActions.length > 0 ? (
                <th className="w-px px-3 py-3">
                  <input
                    type="checkbox"
                    ref={(el) => {
                      if (el) el.indeterminate = selectedVisibleCount > 0 && !allVisibleSelected
                    }}
                    checked={allVisibleSelected}
                    onChange={(event) => toggleVisibleSelection(event.target.checked)}
                    aria-label="Seleccionar esta página"
                  />
                </th>
              ) : null}
              {columns.map((column) => {
                const right = column.align === 'right'
                return (
                  <th
                    key={column.key}
                    style={column.minWidth ? { minWidth: column.minWidth } : undefined}
                    className={cn(
                      'px-5 py-3 text-xs font-medium tracking-wide text-muted-foreground',
                      right ? 'text-right' : 'text-left',
                    )}
                  >
                    <ListColumnHeader column={column} />
                  </th>
                )
              })}
              {hasRowActions && <th className="w-px px-3 py-3" aria-label="Acciones" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => {
              const isClickable = !!(onRowClick || row.href)
              return (
                <tr
                  key={row.id}
                  onClick={(event) => {
                    if (
                      event.target instanceof Element &&
                      event.target.closest(
                        'a, button, input, select, textarea, label, [role="button"]',
                      )
                    )
                      return
                    if (hasTextSelection()) return
                    openRow(row, event.metaKey || event.ctrlKey)
                  }}
                  onAuxClick={(event) => {
                    if (event.button !== 1 || !row.href || onRowClick) return
                    if (event.target instanceof Element && event.target.closest('a')) return
                    openRow(row, true)
                  }}
                  onMouseEnter={() => prefetchRow(row.href)}
                  onFocus={() => prefetchRow(row.href)}
                  className={cn(
                    'group transition-colors hover:bg-muted/40',
                    isClickable && 'cursor-pointer',
                  )}
                >
                  {bulkActions.length > 0 ? (
                    <td className="px-3 py-3 align-middle">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={(event) => {
                          setBulkError(null)
                          setSelectedIds((current) =>
                            event.target.checked
                              ? [...new Set([...current, row.id])]
                              : current.filter((id) => id !== row.id),
                          )
                        }}
                        aria-label={`Seleccionar ${rowLabel(columns, row)}`}
                      />
                    </td>
                  ) : null}
                  {columns.map((column, colIdx) => {
                    const isFirst = colIdx === 0
                    const right = column.align === 'right'
                    return (
                      <td
                        key={column.key}
                        className={cn(
                          'px-5 py-3 align-middle',
                          isFirst ? 'font-medium text-foreground' : 'text-muted-foreground',
                          right && 'text-right',
                        )}
                      >
                        {isFirst && row.href ? (
                          <Link
                            href={row.href}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 underline-offset-2 transition-all group-hover:text-primary hover:underline"
                          >
                            {row.cells[column.key]?.content ?? (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                            <ArrowRight className="size-3.5 shrink-0 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-60" />
                          </Link>
                        ) : (
                          (() => {
                            const c = row.cells[column.key]?.content
                            return c == null || c === '—' ? (
                              <span className="text-muted-foreground/40">—</span>
                            ) : (
                              c
                            )
                          })()
                        )}
                      </td>
                    )
                  })}
                  {hasRowActions && (
                    <td
                      className="px-3 py-2 text-right align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {row.rowActions}
                    </td>
                  )}
                </tr>
              )
            })}
            {addHref && (
              <tr>
                <td
                  colSpan={
                    columns.length + (bulkActions.length > 0 ? 1 : 0) + (hasRowActions ? 1 : 0)
                  }
                  className="px-2 py-1.5"
                >
                  <Link
                    href={addHref}
                    className="flex w-full items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    <Plus className="size-3.5 shrink-0" />
                    {addLabel ?? 'Añadir nuevo'}
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
