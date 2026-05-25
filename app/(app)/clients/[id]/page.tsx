import { BackLink } from "@/components/layout/back-link";
import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateClient } from "../actions";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const supabase = await createServerClient();

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!client) notFound();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status")
    .eq("client_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={client.name as string}
        description={(client.nif as string | null) ?? undefined}
        back={<BackLink href="/clients" label="Volver a clientes" />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Detail card */}
        <Card>
          <CardHeader><CardTitle>Datos</CardTitle></CardHeader>
          <CardContent>
            <DetailGrid>
              <DetailRow label="Email">{(client.email as string | null) ?? "—"}</DetailRow>
              <DetailRow label="Teléfono">{(client.phone as string | null) ?? "—"}</DetailRow>
              <DetailRow label="Contacto">{(client.contact_person as string | null) ?? "—"}</DetailRow>
              <DetailRow label="Creado">{formatDate(client.created_at as string)}</DetailRow>
            </DetailGrid>
            {client.billing_address ? (
              <div className="mt-4 border-t border-border pt-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Dirección</p>
                <p className="whitespace-pre-wrap text-sm">{client.billing_address as string}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Edit card */}
        <Card>
          <CardHeader><CardTitle>Editar</CardTitle></CardHeader>
          <CardContent>
            <form action={updateClient} className="flex flex-col gap-4">
              <input type="hidden" name="id" value={id} />
              <F label="Nombre" id="e_name">
                <Input id="e_name" name="name" defaultValue={client.name as string} required />
              </F>
              <div className="grid gap-4 sm:grid-cols-2">
                <F label="NIF" id="e_nif">
                  <Input id="e_nif" name="nif" defaultValue={(client.nif as string | null) ?? ""} />
                </F>
                <F label="Email" id="e_email">
                  <Input id="e_email" name="email" type="email" defaultValue={(client.email as string | null) ?? ""} />
                </F>
                <F label="Teléfono" id="e_phone">
                  <Input id="e_phone" name="phone" defaultValue={(client.phone as string | null) ?? ""} />
                </F>
                <F label="Contacto" id="e_contact">
                  <Input id="e_contact" name="contact_person" defaultValue={(client.contact_person as string | null) ?? ""} />
                </F>
              </div>
              <F label="Dirección" id="e_addr">
                <Textarea id="e_addr" name="billing_address" rows={2} defaultValue={(client.billing_address as string | null) ?? ""} />
              </F>
              <F label="Notas" id="e_notes">
                <Textarea id="e_notes" name="notes" rows={2} defaultValue={(client.notes as string | null) ?? ""} />
              </F>
              <div className="flex justify-end border-t border-border pt-3">
                <Button type="submit" size="sm">Guardar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Projects */}
      <Card>
        <CardHeader>
          <CardTitle>Proyectos</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {!projects || projects.length === 0 ? (
            <p className="px-6 py-2 text-sm text-muted-foreground">Sin proyectos asociados.</p>
          ) : (
            <ul className="divide-y divide-border">
              {projects.map((p) => (
                <li key={p.id as string} className="flex items-center justify-between px-6 py-2.5 text-sm">
                  <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                    {p.name as string}
                  </Link>
                  <span className="text-xs text-muted-foreground">{p.status as string}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function F({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}
