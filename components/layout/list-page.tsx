import {
  type FilterConfig,
  ListControls,
  type ListControlsProps,
} from "@/components/layout/list-controls";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";

export type ListCell = ReactNode | string | number | null | undefined;
export type ListAlign = "left" | "right";

export type ListRow = {
  id: string;
  href?: string;
  cells: ListCell[];
};

export type ListPageProps = {
  title: string;
  description?: string;
  headers: string[];
  align?: ListAlign[];
  rows: ListRow[];
  empty: string;
  emptyAction?: ReactNode;
  error?: string;
  actions?: ReactNode;
  /** Habilita input de búsqueda persistido en URL bajo searchKey (default "q"). */
  searchKey?: string;
  searchPlaceholder?: string;
  /** Filtros tipo select persistidos en URL. */
  filters?: FilterConfig[];
  /** Paginación basada en URL (?page=). */
  pagination?: ListControlsProps["pagination"];
};

export function ListPage({
  title,
  description,
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
}: ListPageProps) {
  const alignAt = (i: number): ListAlign => align?.[i] ?? "left";
  const hasControls = !!searchKey || (filters && filters.length > 0) || !!pagination;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} actions={actions} />

      <Card>
        <CardContent className="px-0 pt-0">
          {hasControls ? (
            <ListControls
              searchKey={searchKey}
              searchPlaceholder={searchPlaceholder}
              filters={filters}
              pagination={pagination}
            />
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
                  <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                    {headers.map((h, i) => (
                      <th
                        key={h}
                        className={cn(
                          "px-5 py-3 font-medium tracking-wide",
                          alignAt(i) === "right" ? "text-right" : "text-left",
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {rows.map((row) => (
                    <tr key={row.id} className="group transition-colors hover:bg-muted/30">
                      {row.cells.map((c, i) => {
                        const cellKey = `${row.id}:${headers[i] ?? i}`;
                        const isEmpty = c == null || c === "—";
                        const value = isEmpty ? (
                          <span className="text-muted-foreground/40">—</span>
                        ) : (
                          c
                        );
                        const isFirst = i === 0;
                        const right = alignAt(i) === "right";
                        return (
                          <td
                            key={cellKey}
                            className={cn(
                              "px-5 py-3 align-middle",
                              isFirst ? "font-medium text-foreground" : "text-muted-foreground",
                              right && "text-right tabular-nums",
                            )}
                          >
                            {isFirst && row.href ? (
                              <Link
                                href={row.href}
                                className="transition-colors group-hover:text-primary"
                              >
                                {value}
                              </Link>
                            ) : (
                              value
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
