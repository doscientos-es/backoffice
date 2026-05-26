import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AvisosData,
  OverdueInvoiceRow,
  ReminderRow,
  VerifactuPendingRow,
} from "@/lib/dashboard/types";
import { formatDate, formatEUR, relativeTime } from "@/lib/utils";
import { AlertTriangle, BellRing, FileWarning, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { ReminderCompleteButton } from "./_components/reminder-complete-button";

export type { AvisosData, OverdueInvoiceRow, ReminderRow, VerifactuPendingRow };

export type AvisosPanelProps = AvisosData;

const VERIFACTU_VARIANT = {
  pending: "warning",
  error: "danger",
  rejected: "danger",
} as const;

const VERIFACTU_LABEL = {
  pending: "Pendiente",
  error: "Error",
  rejected: "Rechazada",
} as const;

export function AvisosPanel({
  reminders,
  verifactuPending,
  overdueInvoices,
  certExpiresAt,
}: AvisosPanelProps) {
  const empty =
    reminders.length === 0 &&
    verifactuPending.length === 0 &&
    overdueInvoices.length === 0 &&
    !certExpiresAt;

  if (empty) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="size-4" /> Avisos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Sin avisos pendientes. Todo en orden.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="size-4" /> Avisos
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border [&>div]:py-3 first:[&>div]:pt-0 last:[&>div]:pb-0">
        {certExpiresAt ? (
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <div className="flex-1">
              <p className="text-sm font-medium">Certificado Verifactu por caducar</p>
              <p className="text-xs text-muted-foreground">
                Caduca el {formatDate(certExpiresAt)} ({relativeTime(certExpiresAt)}).{" "}
                <Link href="/settings" className="underline">
                  Renovar
                </Link>
                .
              </p>
            </div>
          </div>
        ) : null}

        {reminders.length > 0 ? (
          <Section
            icon={<BellRing className="size-4 text-blue-500" />}
            title={`Recordatorios próximos (${reminders.length})`}
          >
            <ul className="space-y-1.5">
              {reminders.map((r) => {
                const overdue = new Date(r.remind_at) < new Date();
                return (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <Link
                      href={`/reminders/${r.id}`}
                      className="truncate text-sm hover:underline"
                    >
                      {r.title}
                    </Link>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge variant={overdue ? "danger" : "info"}>
                        {relativeTime(r.remind_at)}
                      </Badge>
                      <ReminderCompleteButton id={r.id} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Section>
        ) : null}

        {verifactuPending.length > 0 ? (
          <Section
            icon={<AlertTriangle className="size-4 text-amber-500" />}
            title={`Verifactu pendiente (${verifactuPending.length})`}
          >
            <ul className="space-y-1.5">
              {verifactuPending.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2">
                  <Link href={`/invoices/${v.id}`} className="truncate text-sm hover:underline">
                    {v.full_number ?? v.id.slice(0, 8)}
                    {v.client_name ? (
                      <span className="text-muted-foreground"> · {v.client_name}</span>
                    ) : null}
                  </Link>
                  <Badge variant={VERIFACTU_VARIANT[v.verifactu_status]}>
                    {VERIFACTU_LABEL[v.verifactu_status]}
                  </Badge>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {overdueInvoices.length > 0 ? (
          <Section
            icon={<FileWarning className="size-4 text-red-500" />}
            title={`Facturas vencidas (${overdueInvoices.length})`}
          >
            <ul className="space-y-1.5">
              {overdueInvoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-2">
                  <Link href={`/invoices/${inv.id}`} className="truncate text-sm hover:underline">
                    {inv.full_number ?? inv.id.slice(0, 8)}
                    {inv.client_name ? (
                      <span className="text-muted-foreground"> · {inv.client_name}</span>
                    ) : null}
                  </Link>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatEUR(inv.total)} · venció{" "}
                    {relativeTime(inv.due_date ?? new Date().toISOString())}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Section({
  icon,
  title,
  children,
}: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}
