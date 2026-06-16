import { ListPage } from "@/components/layout/list-page";
import { StatCard } from "@/components/layout/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth";
import { listInvoices } from "@/lib/invoices/queries";
import { INVOICE_LIST_PAGE_SIZE } from "@/lib/invoices/types";
import { INVOICE_STATUS, VERIFACTU_STATUS } from "@/lib/status";
import { formatDate, formatEUR } from "@/lib/utils";
import { parseStringParam, parsePage } from "@/lib/utils/search-params";
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Facturas · doscientos" };
export const dynamic = "force-dynamic";

const STATUS_FILTER_OPTIONS = [
  { value: "draft", label: "Borrador" },
  { value: "issued", label: "Emitida" },
  { value: "paid", label: "Pagada" },
  { value: "overdue", label: "Vencida" },
  { value: "cancelled", label: "Anulada" },
];

const VERIFACTU_FILTER_OPTIONS = [
  { value: "pending", label: "Pendiente" },
  { value: "submitted", label: "Enviada" },
  { value: "accepted", label: "Aceptada" },
  { value: "rejected", label: "Rechazada" },
  { value: "excluded", label: "Excluida" },
];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const sp = await searchParams;
  const q = parseStringParam(sp, "q");
  const status = parseStringParam(sp, "status");
  const verifactu = parseStringParam(sp, "verifactu");
  const page = parsePage(sp);

  const { data, count, stats, error } = await listInvoices({ q, status, verifactu, page });

  const { pendingTotal, pendingCount, overdueTotal, overdueCount, paidMonthTotal, verifactuKoCount } =
    stats;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pendientes de cobro"
          value={formatEUR(pendingTotal)}
          tone="info"
          icon={Clock}
          hint={`${pendingCount} factura(s) emitida(s)`}
          href="/invoices?status=issued"
        />
        <StatCard
          label="Vencidas"
          value={formatEUR(overdueTotal)}
          tone="danger"
          icon={AlertTriangle}
          hint={`${overdueCount} factura(s) vencida(s)`}
          href="/invoices?status=overdue"
        />
        <StatCard
          label="Cobrado este mes"
          value={formatEUR(paidMonthTotal)}
          tone="success"
          icon={CheckCircle2}
          hint={`Desde ${formatDate(monthStart)}`}
        />
        <StatCard
          label="Verifactu KO"
          value={verifactuKoCount}
          tone={verifactuKoCount > 0 ? "danger" : "default"}
          icon={ShieldAlert}
          hint="Rechazadas por AEAT"
          href="/invoices?verifactu=rejected"
        />
      </div>

      <ListPage
        title="Facturas"
        empty={q || status || verifactu ? "Sin coincidencias." : "Aún no hay facturas."}
        error={error ?? undefined}
        searchKey="q"
        searchPlaceholder="Buscar por cliente, nº o IDFACT…"
        filters={[
          { key: "status", label: "Estado", options: STATUS_FILTER_OPTIONS },
          { key: "verifactu", label: "Verifactu", options: VERIFACTU_FILTER_OPTIONS },
        ]}
        pagination={{ page, pageSize: INVOICE_LIST_PAGE_SIZE, total: count }}
        headers={[
          "Nº",
          "Cliente",
          "IDFACT",
          "Estado",
          "Verifactu",
          "Importe",
          "Emisión",
          "Vencimiento",
        ]}
        align={["left", "left", "left", "left", "left", "right", "left", "left"]}
        rows={data.map((i) => ({
          id: i.id,
          href: `/invoices/${i.id}`,
          cells: [
            i.full_number,
            i.client_name ? (
              <span key="client" className="font-medium text-foreground">
                {i.client_name}
              </span>
            ) : null,
            i.idfact,
            <StatusBadge key="status" meta={INVOICE_STATUS} value={i.status ?? ""} />,
            <StatusBadge key="verifactu" meta={VERIFACTU_STATUS} value={i.verifactu_status ?? ""} />,
            formatEUR(i.total ?? 0),
            formatDate(i.issue_date),
            formatDate(i.due_date),
          ],
        }))}
      />
    </div>
  );
}
