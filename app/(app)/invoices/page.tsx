import { ListPage } from "@/components/layout/list-page";
import { Badge } from "@/components/ui/badge";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";

export const metadata = { title: "Facturas · doscientos" };

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

export default async function InvoicesPage() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("id, full_number, idfact, status, verifactu_status, total, issue_date, due_date")
    .is("deleted_at", null)
    .order("issue_date", { ascending: false })
    .limit(50);

  return (
    <ListPage
      title="Facturas"
      empty="Aún no hay facturas."
      error={error?.message}
      headers={["Nº", "IDFACT", "Estado", "Verifactu", "Importe", "Emisión", "Vencimiento"]}
      align={["left", "left", "left", "left", "right", "left", "left"]}
      rows={
        data?.map((i) => {
          const status = i.status as keyof typeof STATUS_VARIANT;
          const verifactu = i.verifactu_status as keyof typeof VERIFACTU_VARIANT;
          return {
            id: i.id as string,
            href: `/invoices/${i.id}`,
            cells: [
              i.full_number as string,
              (i.idfact as string | null) ?? null,
              <Badge key="status" variant={STATUS_VARIANT[status]}>
                {STATUS_LABEL[status] ?? status}
              </Badge>,
              <Badge key="verifactu" variant={VERIFACTU_VARIANT[verifactu]}>
                {VERIFACTU_LABEL[verifactu] ?? verifactu}
              </Badge>,
              formatEUR(i.total as number),
              formatDate(i.issue_date as string),
              formatDate(i.due_date as string | null),
            ],
          };
        }) ?? []
      }
    />
  );
}
