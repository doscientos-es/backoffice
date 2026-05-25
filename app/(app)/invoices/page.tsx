import { ListPage } from "@/components/layout/list-page";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";

export const metadata = { title: "Facturas · doscientos" };

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
      rows={
        data?.map((i) => ({
          id: i.id as string,
          href: `/invoices/${i.id}`,
          cells: [
            i.full_number as string,
            (i.idfact as string | null) ?? "—",
            i.status as string,
            i.verifactu_status as string,
            formatEUR(i.total as number),
            formatDate(i.issue_date as string),
            formatDate(i.due_date as string | null),
          ],
        })) ?? []
      }
    />
  );
}
