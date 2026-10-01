'use client'

import { Download } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { type ReactNode, useCallback, useMemo } from 'react'

import {
  type FilterConfig,
  ListControls,
  type ListControlsProps,
} from '@/components/layout/list-controls'
import { exportToCSV } from '@/components/layout/list-csv'
import { ListTable } from '@/components/layout/list-table'
import { startNavProgress } from '@/components/layout/nav-progress'
import { type BreadcrumbEntry, PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from '@/components/ui/empty-state'

export type { BreadcrumbEntry }

export type ListValue = string | number | null | undefined

/** A cell owns its display and export value; columns select cells by name. */
export type ListCell = { content: ReactNode; value?: ListValue }
export type ListColumn<Key extends string = string> = {
  key: Key
  label: string
  sortKey?: string
  align?: 'left' | 'right'
  minWidth?: string
}
export type ListRow<Data = undefined, Key extends string = string> = {
  id: string
  href?: string
  cells: Record<Key, ListCell>
  data?: Data
  rowActions?: ReactNode
}
export type BulkAction = {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  variant?: 'default' | 'destructive'
  onAction: (ids: string[]) => void | Promise<void>
}
export type ListPageProps<Data = undefined, Key extends string = string> = {
  title: string
  description?: string
  summary?: ReactNode
  breadcrumbs?: BreadcrumbEntry[]
  columns: ListColumn<Key>[]
  rows: ListRow<Data, Key>[]
  empty: string
  emptyAction?: ReactNode
  error?: string
  actions?: ReactNode
  searchKey?: string
  searchPlaceholder?: string
  filters?: FilterConfig[]
  pagination?: ListControlsProps['pagination']
  savedViews?: ListControlsProps['savedViews']
  controlsPresentation?: ListControlsProps['presentation']
  mobileRow?: (row: ListRow<Data, Key>) => ReactNode
  onRowClick?: (row: ListRow<Data, Key>) => void
  addHref?: string
  addLabel?: string
  exportFilename?: string
  bulkActions?: BulkAction[]
}

export function ListPage<Data, Key extends string>({
  title,
  description,
  summary,
  breadcrumbs,
  columns,
  rows,
  empty,
  emptyAction,
  error,
  actions,
  searchKey,
  searchPlaceholder,
  filters,
  pagination,
  savedViews,
  controlsPresentation = 'panel',
  mobileRow,
  onRowClick,
  addHref,
  addLabel,
  exportFilename,
  bulkActions = [],
}: ListPageProps<Data, Key>) {
  const router = useRouter()
  const pathname = usePathname()
  const urlParams = useSearchParams()
  const filterKeys = useMemo(
    () => [
      ...new Set([
        ...(searchKey ? [searchKey] : []),
        ...(filters ?? []).map((filter) => filter.key),
        ...(savedViews?.filterKeys ?? []),
      ]),
    ],
    [filters, savedViews?.filterKeys, searchKey],
  )
  const hasActiveFilters = filterKeys.some((key) => Boolean(urlParams.get(key)))

  const clearAllFilters = useCallback(() => {
    const next = new URLSearchParams(urlParams.toString())
    for (const key of [...filterKeys, 'page']) next.delete(key)
    const query = next.toString()
    startNavProgress()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [filterKeys, pathname, router, urlParams])

  const hasControls = !!searchKey || (filters && filters.length > 0) || !!pagination || !!savedViews

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={breadcrumbs}
        actions={actions}
      />

      {summary}

      <Card>
        <CardContent className="px-0 pt-0">
          {hasControls ? (
            <ListControls
              searchKey={searchKey}
              searchPlaceholder={searchPlaceholder}
              filters={filters}
              pagination={pagination}
              savedViews={savedViews}
              presentation={controlsPresentation}
              className={
                controlsPresentation === 'panel'
                  ? 'rounded-none border-x-0 border-t-0 shadow-none'
                  : undefined
              }
              onExport={
                exportFilename ? () => exportToCSV(columns, rows, exportFilename) : undefined
              }
            />
          ) : null}

          {!hasControls && exportFilename ? (
            <div className="flex justify-end px-3 py-2">
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => exportToCSV(columns, rows, exportFilename)}
                aria-label="Exportar CSV"
                title="Exportar CSV"
              >
                <Download className="size-3.5" />
              </Button>
            </div>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-6"
            >
              <p className="text-sm text-destructive">{error}</p>
              <Button size="sm" variant="outline" onClick={() => router.refresh()}>
                Reintentar
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <Empty className="border-0 py-10">
              <EmptyHeader>
                <EmptyTitle>
                  {hasActiveFilters ? 'No hay resultados con estos filtros' : empty}
                </EmptyTitle>
              </EmptyHeader>
              {hasActiveFilters ? (
                <EmptyContent>
                  <Button size="sm" variant="outline" onClick={clearAllFilters}>
                    Limpiar filtros
                  </Button>
                </EmptyContent>
              ) : emptyAction ? (
                <EmptyContent>{emptyAction}</EmptyContent>
              ) : null}
            </Empty>
          ) : (
            <ListTable
              columns={columns}
              rows={rows}
              mobileRow={mobileRow}
              onRowClick={onRowClick}
              addHref={addHref}
              addLabel={addLabel}
              bulkActions={bulkActions}
              exportFilename={exportFilename}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
