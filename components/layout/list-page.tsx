import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty-state";
import Link from "next/link";
import type { ReactNode } from "react";

export type ListCell = ReactNode | string | number | null | undefined;

export type ListRow = {
  id: string;
  href?: string;
  cells: ListCell[];
};

export type ListPageProps = {
  title: string;
  description?: string;
  headers: string[];
  rows: ListRow[];
  empty: string;
  emptyAction?: ReactNode;
  error?: string;
  actions?: ReactNode;
};

export function ListPage({
  title,
  description,
  headers,
  rows,
  empty,
  emptyAction,
  error,
  actions,
}: ListPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} actions={actions} />

      <Card>
        <CardContent className="px-0 pt-0">
          {error ? (
            <p className="px-5 py-6 text-sm text-[color:var(--danger)]">{error}</p>
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
                <thead className="bg-surface text-left text-xs uppercase tracking-wide text-[color:var(--text-muted)]">
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className="px-5 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]"
                    >
                      {row.cells.map((c, i) => {
                        const cellKey = `${row.id}:${headers[i] ?? i}`;
                        const value = c ?? "—";
                        return (
                          <td key={cellKey} className="px-5 py-2.5 align-middle">
                            {i === 0 && row.href ? (
                              <Link href={row.href} className="font-medium hover:underline">
                                {value}
                              </Link>
                            ) : (
                              <span
                                className={
                                  i === 0 ? "font-medium" : "text-[color:var(--text-secondary)]"
                                }
                              >
                                {value}
                              </span>
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
