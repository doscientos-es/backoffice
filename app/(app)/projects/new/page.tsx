import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { githubDefaultInstallationId } from "@/lib/env";
import { createServerClient } from "@/lib/supabase/server";
import { addDaysIsoLocal, todayIsoLocal } from "@/lib/utils/date";
import type { Metadata } from "next";
import Link from "next/link";
import { createProject } from "../actions";
import { ProjectFormFields } from "../project-form-fields";

export const metadata: Metadata = { title: "Nuevo proyecto · doscientos" };
export const dynamic = "force-dynamic";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string }>;
}) {
  await requireUser();
  const { client_id } = await searchParams;
  const supabase = await createServerClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .is("deleted_at", null)
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nuevo proyecto"
        back={<BackLink href="/projects" label="Volver a proyectos" />}
      />
      <Card>
        <CardContent className="pt-6">
          <form action={createProject} className="flex flex-col gap-5">
            <ProjectFormFields
              idPrefix="new"
              clients={(clients as Array<{ id: string; name: string }> | null) ?? []}
              autoFocusName
              orgDefaultInstallationId={githubDefaultInstallationId()}
              defaults={{
                client_id: client_id ?? "",
                // Suggest a typical 6-week project window starting today.
                starts_at: todayIsoLocal(),
                ends_at: addDaysIsoLocal(42),
              }}
            />
            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button asChild variant="ghost" size="sm">
                <Link href="/projects">Cancelar</Link>
              </Button>
              <SubmitButton pendingLabel="Creando…">Crear proyecto</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
