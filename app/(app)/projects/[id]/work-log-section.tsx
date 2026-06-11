"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { type AvatarMember, MemberLabel } from "@/components/ui/member-avatar";
import { useOptimisticRemoval } from "@/lib/hooks/use-optimistic-removal";
import { formatDate, formatEUR } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { sileo } from "sileo";
import { addWorkLog, deleteWorkLog } from "./work-log-actions";

export type WorkLogRow = {
  id: string;
  work_date: string;
  hours: number;
  note: string | null;
  member: AvatarMember | null;
};

type Props = {
  projectId: string;
  logs: WorkLogRow[];
  /** Total invoiced (€, IVA incl.) for the project, used to derive €/h. */
  invoicedTotal: number;
  canEdit: boolean;
};

const today = () => new Date().toISOString().slice(0, 10);

function formatHours(h: number): string {
  return `${Number.isInteger(h) ? h : h.toFixed(2)} h`;
}

/**
 * Manual daily hours log for a project. Internal-only (never shown in the
 * client portal). The footer derives the effective €/h from total invoiced
 * ÷ logged hours so fixed-price projects can be checked for profitability.
 */
export function WorkLogSection({ projectId, logs, invoicedTotal, canEdit }: Props) {
  const { items, remove, pending } = useOptimisticRemoval(logs);
  const [date, setDate] = useState(today);
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [adding, startAdd] = useTransition();

  const totalHours = items.reduce((sum, it) => sum + it.hours, 0);
  const effectiveRate = totalHours > 0 ? invoicedTotal / totalHours : null;

  function onAdd() {
    const parsed = Number(hours);
    if (!parsed || parsed <= 0) {
      sileo.error({ title: "Introduce un número de horas válido" });
      return;
    }
    startAdd(async () => {
      const res = await addWorkLog({ project_id: projectId, work_date: date, hours: parsed, note });
      if (!res.ok) {
        sileo.error({ title: res.error });
        return;
      }
      setHours("");
      setNote("");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registro de horas</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {canEdit ? (
          <div className="flex flex-wrap items-end gap-2">
            <Input
              type="date"
              value={date}
              max={today()}
              onChange={(e) => setDate(e.target.value)}
              className="w-40"
              aria-label="Fecha"
            />
            <Input
              type="number"
              inputMode="decimal"
              step="0.25"
              min="0.25"
              max="24"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="Horas"
              className="w-24 text-right tabular-nums"
              aria-label="Horas"
            />
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota (opcional)"
              maxLength={500}
              className="min-w-40 flex-1"
              aria-label="Nota"
            />
            <Button size="sm" onClick={onAdd} disabled={adding}>
              Añadir
            </Button>
          </div>
        ) : null}

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin horas registradas.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Miembro</th>
                  <th className="px-3 py-2 font-medium text-right">Horas</th>
                  <th className="px-3 py-2 font-medium">Nota</th>
                  {canEdit ? <th className="w-9 px-1 py-2" aria-label="acciones" /> : null}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                      {formatDate(it.work_date)}
                    </td>
                    <td className="px-3 py-2">
                      <MemberLabel member={it.member} size="xs" />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatHours(it.hours)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{it.note ?? "—"}</td>
                    {canEdit ? (
                      <td className="px-1 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => remove(it.id, () => deleteWorkLog({ id: it.id, project_id: projectId }))}
                          disabled={pending}
                          aria-label="Eliminar entrada"
                          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border bg-muted/20 text-xs">
                <tr>
                  <td colSpan={2} className="px-3 py-2 text-right text-muted-foreground">
                    Total · €/h efectivo
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    {formatHours(totalHours)}
                  </td>
                  <td colSpan={canEdit ? 2 : 1} className="px-3 py-2 tabular-nums">
                    {effectiveRate !== null ? `${formatEUR(effectiveRate)}/h` : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
