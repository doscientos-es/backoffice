"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { type AvatarMember, MemberLabel } from "@/components/ui/member-avatar";
import { useOptimisticRemoval } from "@/lib/hooks/use-optimistic-removal";
import { computeHoursFromRange } from "@/lib/schemas/work-log";
import { formatDate, formatEUR } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { sileo } from "sileo";
import { addWorkLog, deleteWorkLog, updateWorkLog } from "./work-log-actions";

export type WorkLogRow = {
  id: string;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  hours: number;
  note: string | null;
  member: AvatarMember | null;
};

type Props = {
  projectId: string;
  logs: WorkLogRow[];
  /** Total invoiced (€, IVA incl.) for the project, used to derive €/h. */
  invoicedTotal: number;
  /** Billing model. Hourly projects show accrued amount instead of €/h efectivo. */
  billingType?: "fixed" | "hourly";
  /** Configured €/h for hourly projects. Drives the accrued amount in the footer. */
  hourlyRate?: number | null;
  canEdit: boolean;
};

const today = () => new Date().toISOString().slice(0, 10);

const ROWS_PER_PAGE = 10;

function formatHours(h: number): string {
  const totalMin = Math.round(h * 60);
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} h`;
  return `${hrs} h ${mins} min`;
}

/**
 * Manual daily hours log for a project. Internal-only (never shown in the
 * client portal). The footer derives the effective €/h from total invoiced
 * ÷ logged hours so fixed-price projects can be checked for profitability.
 */
export function WorkLogSection({
  projectId,
  logs,
  invoicedTotal,
  billingType = "fixed",
  hourlyRate,
  canEdit,
}: Props) {
  const { items, remove, pending } = useOptimisticRemoval(logs);
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [note, setNote] = useState("");
  const [adding, startAdd] = useTransition();

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / ROWS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const visibleItems = items.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE);

  // Inline edit state for an existing row.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editNote, setEditNote] = useState("");
  const [saving, startSave] = useTransition();

  const totalHours = items.reduce((sum, it) => sum + it.hours, 0);
  const rate = hourlyRate ?? 0;
  const isHourly = billingType === "hourly" && rate > 0;
  const accruedAmount = isHourly ? totalHours * rate : null;
  const effectiveRate = totalHours > 0 ? invoicedTotal / totalHours : null;

  const addDuration = startTime && endTime ? computeHoursFromRange(startTime, endTime) : null;
  const editDuration = editStart && editEnd ? computeHoursFromRange(editStart, editEnd) : null;

  function onAdd() {
    if (addDuration === null) {
      sileo.error({ title: "La hora de fin debe ser posterior a la de inicio." });
      return;
    }
    startAdd(async () => {
      const res = await addWorkLog({
        project_id: projectId,
        work_date: date,
        start_time: startTime,
        end_time: endTime,
        note,
      });
      if (!res.ok) {
        sileo.error({ title: res.error });
        return;
      }
      setStartTime("");
      setEndTime("");
      setNote("");
    });
  }

  function startEdit(it: WorkLogRow) {
    setEditingId(it.id);
    setEditStart(it.start_time ?? "");
    setEditEnd(it.end_time ?? "");
    setEditNote(it.note ?? "");
  }

  function onSaveEdit(id: string) {
    const hasRange = !!editStart && !!editEnd;
    if (!editStart !== !editEnd) {
      sileo.error({ title: "Indica inicio y fin, o deja ambos vacíos." });
      return;
    }
    if (hasRange && editDuration === null) {
      sileo.error({ title: "La hora de fin debe ser posterior a la de inicio." });
      return;
    }
    startSave(async () => {
      const res = await updateWorkLog({
        id,
        project_id: projectId,
        start_time: hasRange ? editStart : undefined,
        end_time: hasRange ? editEnd : undefined,
        note: editNote,
      });
      if (!res.ok) {
        sileo.error({ title: res.error });
        return;
      }
      setEditingId(null);
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
            <div className="flex items-end gap-1">
              <Input
                type="time"
                value={startTime}
                max={endTime || undefined}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-28 tabular-nums"
                aria-label="Hora de inicio"
              />
              <span className="pb-2 text-muted-foreground">→</span>
              <Input
                type="time"
                value={endTime}
                min={startTime || undefined}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-28 tabular-nums"
                aria-label="Hora de fin"
              />
            </div>
            <span className="pb-2 text-sm tabular-nums text-muted-foreground">
              {addDuration !== null ? formatHours(addDuration) : "—"}
            </span>
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
                {visibleItems.map((it) =>
                  canEdit && editingId === it.id ? (
                    <tr key={it.id} className="border-t border-border bg-muted/20">
                      <td colSpan={5} className="px-3 py-2">
                        <div className="flex flex-wrap items-end gap-2">
                          <span className="self-center whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                            {formatDate(it.work_date)}
                          </span>
                          <div className="flex items-end gap-1">
                            <Input
                              type="time"
                              value={editStart}
                              max={editEnd || undefined}
                              onChange={(e) => setEditStart(e.target.value)}
                              className="w-28 tabular-nums"
                              aria-label="Hora de inicio"
                            />
                            <span className="pb-2 text-muted-foreground">→</span>
                            <Input
                              type="time"
                              value={editEnd}
                              min={editStart || undefined}
                              onChange={(e) => setEditEnd(e.target.value)}
                              className="w-28 tabular-nums"
                              aria-label="Hora de fin"
                            />
                          </div>
                          <span className="pb-2 text-sm tabular-nums text-muted-foreground">
                            {editDuration !== null ? formatHours(editDuration) : "—"}
                          </span>
                          <Input
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            placeholder="Nota (opcional)"
                            maxLength={500}
                            className="min-w-40 flex-1"
                            aria-label="Nota"
                          />
                          <Button size="sm" onClick={() => onSaveEdit(it.id)} disabled={saving}>
                            Guardar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                            disabled={saving}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={it.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                        {formatDate(it.work_date)}
                      </td>
                      <td className="px-3 py-2">
                        <MemberLabel member={it.member} size="xs" />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatHours(it.hours)}
                        {it.start_time && it.end_time ? (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {it.start_time}–{it.end_time}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{it.note ?? "—"}</td>
                      {canEdit ? (
                        <td className="px-1 py-2">
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              type="button"
                              onClick={() => startEdit(it)}
                              aria-label="Editar entrada"
                              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              <Pencil className="size-3.5" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                remove(it.id, () =>
                                  deleteWorkLog({ id: it.id, project_id: projectId }),
                                )
                              }
                              disabled={pending}
                              aria-label="Eliminar entrada"
                              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
                            >
                              <Trash2 className="size-3.5" aria-hidden />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ),
                )}
              </tbody>
              <tfoot className="border-t border-border bg-muted/20 text-xs">
                <tr>
                  <td colSpan={2} className="px-3 py-2 text-right text-muted-foreground">
                    {isHourly ? "Total · Importe acumulado" : "Total · €/h efectivo"}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    {formatHours(totalHours)}
                  </td>
                  <td colSpan={canEdit ? 2 : 1} className="px-3 py-2 tabular-nums">
                    {isHourly
                      ? `${formatEUR(accruedAmount ?? 0)} · ${formatEUR(rate)}/h`
                      : effectiveRate !== null
                        ? `${formatEUR(effectiveRate)}/h`
                        : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
                <span>
                  {(safePage - 1) * ROWS_PER_PAGE + 1}–
                  {Math.min(safePage * ROWS_PER_PAGE, items.length)} de {items.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    aria-label="Página anterior"
                    className="inline-flex size-6 items-center justify-center rounded hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <span className="tabular-nums">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    aria-label="Página siguiente"
                    className="inline-flex size-6 items-center justify-center rounded hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
