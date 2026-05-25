import { ListPage } from "@/components/layout/list-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createServerClient } from "@/lib/supabase/server";
import { relativeTime } from "@/lib/utils";
import { Plus } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Leads · doscientos" };

const STATUS_VARIANT = {
  new: "info",
  qualifying: "warning",
  quoted: "warning",
  won: "success",
  lost: "danger",
  archived: "neutral",
} as const;

export default async function LeadsPage() {
  const supabase = await createServerClient();
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, name, company, email, status, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <ListPage
      title="Leads"
      description="Oportunidades comerciales sin contrato firmado."
      headers={["Nombre", "Empresa", "Email", "Estado", "Creado"]}
      empty="Aún no hay leads."
      emptyAction={
        <Button asChild size="sm">
          <Link href="/leads/new">
            <Plus className="h-4 w-4" />
            Nuevo lead
          </Link>
        </Button>
      }
      actions={
        <Button asChild size="sm">
          <Link href="/leads/new">
            <Plus className="h-4 w-4" />
            Nuevo lead
          </Link>
        </Button>
      }
      error={error?.message}
      rows={
        leads?.map((l) => ({
          id: l.id as string,
          href: `/leads/${l.id}`,
          cells: [
            l.name as string,
            (l.company as string | null) ?? "—",
            (l.email as string | null) ?? "—",
            <Badge
              key="s"
              variant={STATUS_VARIANT[l.status as keyof typeof STATUS_VARIANT]}
            >
              {l.status as string}
            </Badge>,
            relativeTime(l.created_at as string),
          ],
        })) ?? []
      }
    />
  );
}
