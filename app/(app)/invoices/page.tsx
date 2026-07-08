import { ListPage } from "@/components/layout/list-page";
import { StatCard } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth";
import { listInvoices } from "@/lib/invoices/queries";
import { INVOICE_LIST_PAGE_SIZE } from "@/lib/invoices/types";
import { INVOICE_SORT_COLUMNS } from "@/lib/invoices/types";
import { INVOICE_STATUS, VERIFACTU_STATUS } from "@/lib/status";
import { formatDate, formatEUR } from "@/lib/utils";
import { parsePage, parseSortParam, parseStringParam } from "@/lib/utils/search-params";
import { AlertTriangle, CheckCircle2, Clock, Download, ShieldAlert } from "lucide-react";
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
  const { sort, dir } = parseSortParam(sp, INVOICE_SORT_COLUMNS, "issue_date", "desc");

  const { data, count, stats, error } = await listInvoices({ q, status, verifactu, page, sort, dir });

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
        actions={
          <Button variant="outline" size="sm" asChild>
            <a
              href={`/api/invoices/libro-registro?year=${now.getFullYear()}`}
              download={`libro-registro-${now.getFullYear()}.csv`}
            >
              <Download className="mr-2 h-4 w-4" />
              Libro Registro {now.getFullYear()}
            </a>
          </Button>
        }
        filters={[
          { key: "status", label: "Estado", options: STATUS_FILTER_OPTIONS },
          { key: "verifactu", label: "Verifactu", options: VERIFACTU_FILTER_OPTIONS },
        ]}
        pagination={{ page, pageSize: INVOICE_LIST_PAGE_SIZE, total: count }}
        headers={[
          { label: "Nº", sortKey: "full_number", minWidth: "8rem" },
          { label: "Cliente", sortKey: "client_name", minWidth: "10rem" },
          "IDFACT",
          { label: "Estado", sortKey: "status" },
          "Verifactu",
          { label: "Importe", align: "right", sortKey: "total" },
          { label: "Emisión", sortKey: "issue_date", minWidth: "7rem" },
          { label: "Vencimiento", sortKey: "due_date", minWidth: "7rem" },
        ]}
        align={["left", "left", "left", "left", "left", "right", "left", "left"]}
        exportFilename="facturas"
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
          csvValues: [
            i.full_number ?? "",
            i.client_name ?? "",
            i.idfact ?? "",
            i.status ?? "",
            i.verifactu_status ?? "",
            i.total ?? 0,
            i.issue_date ?? "",
            i.due_date ?? "",
          ],
        }))}
      />
    </div>
  );
}
