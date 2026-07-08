"use client";

import {
  type FilterConfig,
  ListControls,
  type ListControlsProps,
} from "@/components/layout/list-controls";
import { type BreadcrumbEntry, PageHeader } from "@/components/layout/page-header";
export type { BreadcrumbEntry };
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, Download, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";

export type ListCell = ReactNode | string | number | null | undefined;
export type ListAlign = "left" | "right";

export type ListHeader =
  | string
  | {
    label: string;
    /** Activa la ordenación cliente (requiere `sortValues` en las filas). */
    sortable?: boolean;
    /**
     * Clave de columna DB para ordenación en el servidor.
     * Al hacer clic actualiza los URL params `sort` + `dir` y resetea `page`.
     * Tiene preferencia sobre `sortable`.
     */
    sortKey?: string;
    align?: ListAlign;
    /** Ancho mínimo CSS para la columna (ej. "8rem"). Evita wrapping en celdas cortas. */
    minWidth?: string;
  };

export type ListRow = {
  id: string;
  href?: string;
  cells: ListCell[];
  /** Valores planos paralelos a `cells` usados para ordenar. */
  sortValues?: (string | number | null | undefined)[];
  /** Valores planos paralelos a `cells` usados para el CSV exportado. */
  csvValues?: (string | number | null | undefined)[];
  data?: unknown;
  /** Acciones inline (editar, eliminar…) renderizadas en la última columna. */
  rowActions?: ReactNode;
};

export type BulkAction = {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: "default" | "destructive";
  onAction: (ids: string[]) => void | Promise<void>;
};

export type ListPageProps = {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbEntry[];
  headers: ListHeader[];
  /** Alineación por columna (backward-compat; también se puede poner en `headers`). */
  align?: ListAlign[];
  rows: ListRow[];
  empty: string;
  emptyAction?: ReactNode;
  error?: string;
  actions?: ReactNode;
  searchKey?: string;
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  pagination?: ListControlsProps["pagination"];
  onRowClick?: (row: ListRow) => void;
  addHref?: string;
  addLabel?: string;
  /** Nombre del fichero CSV sin extensión. Si se provee, muestra botón Exportar. */
  exportFilename?: string;
};

// ─── helpers ────────────────────────────────────────────────────────────────

function headerLabel(h: ListHeader): string {
  return typeof h === "string" ? h : h.label;
}
function headerSortable(h: ListHeader): boolean {
  return typeof h !== "string" && !!h.sortable;
}
function headerSortKey(h: ListHeader): string | undefined {
  return typeof h !== "string" ? h.sortKey : undefined;
}
function headerAlign(h: ListHeader, fallback?: ListAlign): ListAlign {
  if (typeof h !== "string" && h.align) return h.align;
  return fallback ?? "left";
}
function headerMinWidth(h: ListHeader): string | undefined {
  return typeof h !== "string" ? h.minWidth : undefined;
}

function exportToCSV(headers: ListHeader[], rows: ListRow[], filename: string) {
  const labels = headers.map(headerLabel);
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csvRows = rows.map((row) =>
    headers.map((_, i) => {
      const csv = row.csvValues?.[i];
      if (csv !== undefined && csv !== null) return escape(String(csv));
      const cell = row.cells[i];
      if (typeof cell === "string" || typeof cell === "number") return escape(String(cell));
      return '""';
    }),
  );
  const content = [labels.map(escape).join(","), ...csvRows.map((r) => r.join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── component ──────────────────────────────────────────────────────────────

export function ListPage({
  title,
  description,
  breadcrumbs,
  headers,
  align,
  rows,
  empty,
  emptyAction,
  error,
  actions,
  searchKey,
  searchPlaceholder,
  filters,
  pagination,
  onRowClick,
  addHref,
  addLabel,
  exportFilename,
}: ListPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const urlParams = useSearchParams();
  const prefetched = useRef<Set<string>>(new Set());

  // Server-side sort state (from URL)
  const serverSortKey = urlParams.get("sort") ?? "";
  const serverSortDir = (urlParams.get("dir") ?? "asc") as "asc" | "desc";

  // Client-side sort state (TanStack, for sortable-without-sortKey columns)
  const [sorting, setSorting] = useState<SortingState>([]);

  const prefetchRow = useCallback(
    (href?: string) => {
      if (!href || prefetched.current.has(href)) return;
      prefetched.current.add(href);
      router.prefetch(href);
    },
    [router],
  );

  const handleServerSort = useCallback(
    (sortKey: string) => {
      const isActive = serverSortKey === sortKey;
      const newDir = isActive && serverSortDir === "asc" ? "desc" : "asc";
      const next = new URLSearchParams(urlParams.toString());
      next.set("sort", sortKey);
      next.set("dir", newDir);
      next.delete("page");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [router, pathname, urlParams, serverSortKey, serverSortDir],
  );

  // ── Column definitions ──────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<ListRow>[]>(() =>
    headers.map((h, colIdx) => {
      const sortable = headerSortable(h);
      const sortKey = headerSortKey(h);
      return {
        id: `col_${colIdx}`,
        accessorFn: (row) => row.sortValues?.[colIdx] ?? null,
        header: ({ column }) => {
          const label = headerLabel(h);

          // Server-side sort (via URL param)
          if (sortKey) {
            const isActive = serverSortKey === sortKey;
            const isAsc = isActive && serverSortDir === "asc";
            const isDesc = isActive && serverSortDir === "desc";
            return (
              <button
                type="button"
                onClick={() => handleServerSort(sortKey)}
                className="inline-flex items-center gap-1 text-xs font-medium tracking-wide text-muted-foreground hover:text-foreground"
              >
                {label}
                {isAsc ? (
                  <ArrowUp className="size-3 text-primary" />
                ) : isDesc ? (
                  <ArrowDown className="size-3 text-primary" />
                ) : (
                  <ArrowUpDown className="size-3 opacity-40" />
                )}
              </button>
            );
          }

          // Client-side sort (TanStack, current page only)
          if (!sortable) return label;
          const sorted = column.getIsSorted();
          return (
            <button
              type="button"
              onClick={() => column.toggleSorting(sorted === "asc")}
              className="inline-flex items-center gap-1 text-xs font-medium tracking-wide text-muted-foreground hover:text-foreground"
            >
              {label}
              {sorted === "asc" ? (
                <ArrowUp className="size-3 text-primary" />
              ) : sorted === "desc" ? (
                <ArrowDown className="size-3 text-primary" />
              ) : (
                <ArrowUpDown className="size-3 opacity-40" />
              )}
            </button>
          );
        },
        cell: ({ row }) => row.original.cells[colIdx],
        enableSorting: sortable && !sortKey,
        sortingFn: "alphanumeric",
      };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [headers, serverSortKey, serverSortDir, handleServerSort]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
  });

  const hasControls = !!searchKey || (filters && filters.length > 0) || !!pagination;
  const hasRowActions = rows.some((r) => r.rowActions != null);

  const alignAt = (colIdx: number): ListAlign =>
    headerAlign(headers[colIdx] ?? "left", align?.[colIdx]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={breadcrumbs}
        actions={actions}
      />

      <Card>
        <CardContent className="px-0 pt-0">
          {hasControls ? (
            <ListControls
              searchKey={searchKey}
              searchPlaceholder={searchPlaceholder}
              filters={filters}
              pagination={pagination}
              onExport={
                exportFilename ? () => exportToCSV(headers, rows, exportFilename) : undefined
              }
            />
          ) : null}

          {!hasControls && exportFilename ? (
            <div className="flex justify-end px-3 py-2">
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => exportToCSV(headers, rows, exportFilename)}
                aria-label="Exportar CSV"
                title="Exportar CSV"
              >
                <Download className="size-3.5" />
              </Button>
            </div>
          ) : null}

          {error ? (
            <p className="px-5 py-6 text-sm text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <Empty className="border-0 py-10">
              <EmptyHeader>
                <EmptyTitle>{empty}</EmptyTitle>
              </EmptyHeader>
              {emptyAction ? <EmptyContent>{emptyAction}</EmptyContent> : null}
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {table.getFlatHeaders().map((header, colIdx) => {
                      const right = alignAt(colIdx) === "right";
                      return (
                        <th
                          key={header.id}
                          style={headerMinWidth(headers[colIdx] ?? "") ? { minWidth: headerMinWidth(headers[colIdx] ?? "") } : undefined}
                          className={cn(
                            "px-5 py-3 text-xs font-medium tracking-wide text-muted-foreground",
                            right ? "text-right" : "text-left",
                          )}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      );
                    })}
                    {hasRowActions && <th className="w-px px-3 py-3" aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {table.getRowModel().rows.map((tableRow) => {
                    const row = tableRow.original;
                    const isClickable = !!(onRowClick || row.href);
                    return (
                      <tr
                        key={tableRow.id}
                        onClick={() => {
                          if (onRowClick) onRowClick(row);
                          else if (row.href) router.push(row.href);
                        }}
                        onMouseEnter={() => prefetchRow(row.href)}
                        onFocus={() => prefetchRow(row.href)}
                        className={cn(
                          "group transition-colors hover:bg-muted/40",
                          isClickable && "cursor-pointer",
                        )}
                      >
                        {tableRow.getVisibleCells().map((cell, colIdx) => {
                          const isFirst = colIdx === 0;
                          const right = alignAt(colIdx) === "right";
                          return (
                            <td
                              key={cell.id}
                              className={cn(
                                "px-5 py-3 align-middle",
                                isFirst
                                  ? "font-medium text-foreground"
                                  : "text-muted-foreground",
                                right && "text-right",
                              )}
                            >
                              {isFirst && row.href ? (
                                <Link
                                  href={row.href}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1.5 underline-offset-2 transition-all hover:underline group-hover:text-primary"
                                >
                                  {row.cells[colIdx] ?? <span className="text-muted-foreground/40">—</span>}
                                  <ArrowRight className="size-3.5 shrink-0 opacity-0 -translate-x-1 transition-all group-hover:opacity-60 group-hover:translate-x-0" />
                                </Link>
                              ) : (
                                (() => {
                                  const c = row.cells[colIdx];
                                  return c == null || c === "—" ? (
                                    <span className="text-muted-foreground/40">—</span>
                                  ) : (
                                    c
                                  );
                                })()
                              )}
                            </td>
                          );
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
                    );
                  })}
                  {addHref && (
                    <tr>
                      <td colSpan={table.getFlatHeaders().length} className="px-2 py-1.5">
                        <Link
                          href={addHref}
                          className="flex w-full items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                        >
                          <Plus className="size-3.5 shrink-0" />
                          {addLabel ?? "Añadir nuevo"}
                        </Link>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
