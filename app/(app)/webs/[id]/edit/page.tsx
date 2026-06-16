import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DangerZone } from "@/components/ui/danger-zone";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { getWebProject } from "@/lib/webs/queries";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteWebProject, updateWebProject } from "../../actions";
import { WebFormFields } from "../../_components/web-form-fields";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const site = await getWebProject(id);
  return { title: site ? `Editar ${site.name} · doscientos` : "Editar web · doscientos" };
}

export default async function EditWebPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  const [site, { data: clients }] = await Promise.all([
    getWebProject(id),
    (await import("@/lib/supabase/server").then((m) => m.createServerClient())).then((sb) =>
      sb.from("clients").select("id, name").is("deleted_at", null).order("name"),
    ),
  ]);

  if (!site) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Editar · ${site.name}`}
        back={<BackLink href={`/webs/${id}`} label="Volver al detalle" />}
      />

      <Card>
        <CardContent className="pt-6">
          <form action={updateWebProject} className="flex flex-col gap-5">
            <input type="hidden" name="id" value={id} />
            <WebFormFields
              idPrefix="edit"
              clients={(clients as Array<{ id: string; name: string }> | null) ?? []}
              defaults={site}
            />
            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button asChild variant="ghost" size="sm">
                <Link href={`/webs/${id}`}>Cancelar</Link>
              </Button>
              <SubmitButton pendingLabel="Guardando…">Guardar cambios</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      <DangerZone
        title="Eliminar web"
        description="Esta acción es permanente. La web se eliminará del sistema."
      >
        <form action={deleteWebProject}>
          <input type="hidden" name="id" value={id} />
          <SubmitButton variant="destructive" pendingLabel="Eliminando…" size="sm">
            Eliminar web
          </SubmitButton>
        </form>
      </DangerZone>
    </div>
  );
}
