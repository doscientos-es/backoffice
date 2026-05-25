import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export type ListRow = {
  id: string;
  href?: string;
  cells: (string | number | null | undefined)[];
};

export type ListPageProps = {
  title: string;
  headers: string[];
  rows: ListRow[];
  empty: string;
  error?: string;
};

export function ListPage({ title, headers, rows, empty, error }: ListPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimos 50</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {error ? (
            <p className="px-5 text-sm text-[color:var(--danger)]">{error}</p>
          ) : rows.length === 0 ? (
            <p className="px-5 text-sm text-[color:var(--text-muted)]">{empty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[color:var(--surface)] text-left text-xs uppercase tracking-wide text-[color:var(--text-muted)]">
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
                        return (
                          <td key={cellKey} className="px-5 py-2.5">
                            {i === 0 && row.href ? (
                              <Link href={row.href} className="font-medium hover:underline">
                                {c ?? "—"}
                              </Link>
                            ) : (
                              <span
                                className={
                                  i === 0 ? "font-medium" : "text-[color:var(--text-secondary)]"
                                }
                              >
                                {c ?? "—"}
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
