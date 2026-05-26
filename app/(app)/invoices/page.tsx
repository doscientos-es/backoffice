import { ListPage } from "@/components/layout/list-page";
import { StatCard } from "@/components/layout/stat-card";
import { Badge } from "@/components/ui/badge";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert } from "lucide-react";

export const metadata = { title: "Facturas · doscientos" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

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

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (m) => `\\${m}`);
}

const STATUS_VARIANT = {
  draft: "neutral",
  issued: "info",
  paid: "success",
  overdue: "danger",
  cancelled: "danger",
} as const;

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  issued: "Emitida",
  paid: "Pagada",
  overdue: "Vencida",
  cancelled: "Anulada",
};

const VERIFACTU_VARIANT = {
  pending: "warning",
  submitted: "info",
  accepted: "success",
  rejected: "danger",
  excluded: "neutral",
} as const;

const VERIFACTU_LABEL: Record<string, string> = {
  pending: "Pendiente",
  submitted: "Enviada",
  accepted: "Aceptada",
  rejected: "Rechazada",
  excluded: "Excluida",
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    verifactu?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = (sp.status ?? "").trim();
  const verifactu = (sp.verifactu ?? "").trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createServerClient();

  // Aggregates for stat cards (computed in parallel with the list query).
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const [listRes, pendingRes, overdueRes, paidMonthRes, verifactuKoRes] = await Promise.all([
    (() => {
      let query = supabase
        .from("invoices")
        .select("id, full_number, idfact, status, verifactu_status, total, issue_date, due_date", {
          count: "exact",
        })
        .is("deleted_at", null);
      if (q.length > 0) {
        const pattern = `%${escapeIlike(q)}%`;
        query = query.or(`full_number.ilike.${pattern},idfact.ilike.${pattern}`);
      }
      if (status) query = query.eq("status", status);
      if (verifactu) query = query.eq("verifactu_status", verifactu);
      return query.order("issue_date", { ascending: false }).range(from, to);
    })(),
    supabase
      .from("invoices")
      .select("total", { count: "exact" })
      .is("deleted_at", null)
      .eq("status", "issued"),
    supabase
      .from("invoices")
      .select("total", { count: "exact" })
      .is("deleted_at", null)
      .eq("status", "overdue"),
    supabase
      .from("invoices")
      .select("total")
      .is("deleted_at", null)
      .eq("status", "paid")
      .gte("issue_date", monthStart),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("verifactu_status", "rejected"),
  ]);

  const { data, error, count } = listRes;
  const pendingTotal = (pendingRes.data ?? []).reduce((acc, r) => acc + Number(r.total ?? 0), 0);
  const overdueTotal = (overdueRes.data ?? []).reduce((acc, r) => acc + Number(r.total ?? 0), 0);
  const paidMonthTotal = (paidMonthRes.data ?? []).reduce(
    (acc, r) => acc + Number(r.total ?? 0),
    0,
  );
  const verifactuKoCount = verifactuKoRes.count ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pendientes de cobro"
          value={formatEUR(pendingTotal)}
          tone="info"
          icon={Clock}
          hint={`${pendingRes.count ?? 0} factura(s) emitida(s)`}
          href="/invoices?status=issued"
        />
        <StatCard
          label="Vencidas"
          value={formatEUR(overdueTotal)}
          tone="danger"
          icon={AlertTriangle}
          hint={`${overdueRes.count ?? 0} factura(s) vencida(s)`}
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
        error={error?.message}
        searchKey="q"
        searchPlaceholder="Buscar por nº o IDFACT…"
        filters={[
          { key: "status", label: "Estado", options: STATUS_FILTER_OPTIONS },
          { key: "verifactu", label: "Verifactu", options: VERIFACTU_FILTER_OPTIONS },
        ]}
        pagination={{ page, pageSize: PAGE_SIZE, total: count ?? 0 }}
        headers={["Nº", "IDFACT", "Estado", "Verifactu", "Importe", "Emisión", "Vencimiento"]}
        align={["left", "left", "left", "left", "right", "left", "left"]}
        rows={
          data?.map((i) => {
            const s = i.status as keyof typeof STATUS_VARIANT;
            const v = i.verifactu_status as keyof typeof VERIFACTU_VARIANT;
            return {
              id: i.id as string,
              href: `/invoices/${i.id}`,
              cells: [
                i.full_number as string,
                (i.idfact as string | null) ?? null,
                <Badge key="status" variant={STATUS_VARIANT[s]}>
                  {STATUS_LABEL[s] ?? s}
                </Badge>,
                <Badge key="verifactu" variant={VERIFACTU_VARIANT[v]}>
                  {VERIFACTU_LABEL[v] ?? v}
                </Badge>,
                formatEUR(i.total as number),
                formatDate(i.issue_date as string),
                formatDate(i.due_date as string | null),
              ],
            };
          }) ?? []
        }
      />
    </div>
  );
}
