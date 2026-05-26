import { ListPage } from "@/components/layout/list-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";
import { Plus } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Propuestas · doscientos" };
export const dynamic = "force-dynamic";

const STATUS_VARIANT = {
  draft: "neutral",
  sent: "info",
  viewed: "warning",
  accepted: "success",
  rejected: "danger",
  expired: "danger",
} as const;

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviada",
  viewed: "Vista",
  accepted: "Aceptada",
  rejected: "Rechazada",
  expired: "Expirada",
};

export default async function ProposalsPage() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("proposals")
    .select("id, number, title, status, total, valid_until")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  const newAction = (
    <Button asChild size="sm">
      <Link href="/proposals/new">
        <Plus className="h-4 w-4" />
        Nueva propuesta
      </Link>
    </Button>
  );

  return (
    <ListPage
      title="Propuestas"
      empty="Aún no hay propuestas."
      error={error?.message}
      actions={newAction}
      emptyAction={newAction}
      headers={["Número", "Título", "Estado", "Importe", "Válida hasta"]}
      align={["left", "left", "left", "right", "left"]}
      rows={
        data?.map((p) => {
          const status = p.status as keyof typeof STATUS_VARIANT;
          return {
            id: p.id as string,
            href: `/proposals/${p.id}`,
            cells: [
              p.number as string,
              p.title as string,
              <Badge key="status" variant={STATUS_VARIANT[status]}>
                {STATUS_LABEL[status] ?? status}
              </Badge>,
              formatEUR(p.total as number),
              formatDate(p.valid_until as string | null),
            ],
          };
        }) ?? []
      }
    />
  );
}
