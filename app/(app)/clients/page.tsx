import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { listClients } from "@/lib/clients/queries";
import { CLIENT_LIST_PAGE_SIZE } from "@/lib/clients/types";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ClientsList } from "./clients-list";

export const metadata: Metadata = { title: "Clientes · doscientos" };
export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const { data, count } = await listClients({ q, page });

  return (
    <ClientsList
      title="Clientes"
      empty={q ? "Sin coincidencias para tu búsqueda." : "Aún no hay clientes."}
      error={undefined}
      searchKey="q"
      searchPlaceholder="Buscar por nombre, NIF o email…"
      pagination={{ page, pageSize: CLIENT_LIST_PAGE_SIZE, total: count }}
      addHref="/clients/new"
      addLabel="Nuevo cliente"
      actions={
        <Button asChild size="sm">
          <Link href="/clients/new">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo
          </Link>
        </Button>
      }
      emptyAction={
        <Button asChild size="sm">
          <Link href="/clients/new">
            <Plus className="mr-2 h-4 w-4" />
            Crear primer cliente
          </Link>
        </Button>
      }
      rows={
        data?.map((c) => ({
          id: c.id as string,
          href: `/clients/${c.id}`,
          data: {
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            nif: c.nif,
            contact_person: c.contact_person,
            updated_at: c.updated_at,
          },
          cells: [
            c.name as string,
            (c.nif as string | null) ?? "—",
            (c.email as string | null) ?? "—",
          ],
        })) ?? []
      }
      headers={["Nombre", "NIF", "Email"]}
    />
  );
}
