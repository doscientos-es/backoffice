"use client";

import { BellRing, CalendarClock, CircleX, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InvoicePaymentFollowUp } from "@/lib/invoices/payment-follow-ups";
import { formatDate } from "@/lib/utils";

import {
  cancelInvoicePaymentFollowUpAction,
  rescheduleInvoicePaymentFollowUpAction,
} from "../automation-actions";

function localDateTime(value: string): string {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function InvoiceAutomationPanel({
  invoiceId,
  automation,
  canEdit,
}: {
  invoiceId: string;
  automation: InvoicePaymentFollowUp | null;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [runAt, setRunAt] = useState(automation ? localDateTime(automation.run_at) : "");
  const [error, setError] = useState<string | null>(null);
  if (!automation) return null;

  const active = automation.status === "pending" || automation.status === "failed";
  const statusLabel =
    automation.status === "sent"
      ? "Enviado"
      : automation.status === "cancelled"
        ? "Cancelado"
        : automation.status === "failed"
          ? "Revisar: falló el envío"
          : automation.status === "skipped"
            ? "No enviado"
            : "Pendiente";

  function cancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelInvoicePaymentFollowUpAction({ invoiceId });
      if (!result.ok) setError(result.error);
    });
  }

  function reschedule() {
    setError(null);
    startTransition(async () => {
      const result = await rescheduleInvoicePaymentFollowUpAction({
        invoiceId,
        runAt: new Date(runAt).toISOString(),
      });
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <section
      className="border-primary/20 bg-primary/[0.03] rounded-xl border p-4"
      aria-label="Seguimiento automático"
    >
      <div className="flex items-start gap-3">
        <BellRing className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Seguimiento automático de cobro</h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {active
                  ? `Si sigue pendiente, enviaremos este email el ${formatDate(automation.run_at)}.`
                  : statusLabel}
              </p>
            </div>
            <span className="text-muted-foreground text-xs font-medium">{statusLabel}</span>
          </div>

          <div className="bg-background/80 rounded-lg border p-3 text-sm">
            <p className="text-muted-foreground text-xs">Para {automation.recipient}</p>
            <p className="mt-1 font-medium">{automation.subject}</p>
            <p className="text-muted-foreground mt-2 whitespace-pre-line text-xs leading-5">
              {automation.message}
            </p>
          </div>

          {canEdit && active ? (
            <div className="flex flex-wrap items-end gap-2">
              <label
                htmlFor="invoice-payment-follow-up-run-at"
                className="text-muted-foreground flex min-w-52 flex-1 flex-col gap-1 text-xs"
              >
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="size-3" /> Cambiar fecha
                </span>
                <Input
                  id="invoice-payment-follow-up-run-at"
                  type="datetime-local"
                  value={runAt}
                  onChange={(event) => setRunAt(event.target.value)}
                  disabled={pending}
                />
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={reschedule}
                disabled={pending || !runAt}
              >
                {pending ? <LoaderCircle className="mr-1.5 size-3.5 animate-spin" /> : null}
                Guardar fecha
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={cancel} disabled={pending}>
                <CircleX className="mr-1.5 size-3.5" /> No enviarlo
              </Button>
            </div>
          ) : null}
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
          {automation.last_error ? (
            <p className="text-destructive text-xs">{automation.last_error}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
