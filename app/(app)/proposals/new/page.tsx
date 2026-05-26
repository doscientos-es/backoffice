import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { NewProposalForm } from "./new-proposal-form";

export const metadata: Metadata = { title: "Nueva propuesta · doscientos" };
export const dynamic = "force-dynamic";

export default async function NewProposalPage({
  searchParams,
}: { searchParams: Promise<{ client_id?: string; project_id?: string }> }) {
  await requireUser();
  const { client_id, project_id } = await searchParams;

  const supabase = await createServerClient();
  const [{ data: clients }, { data: projects }] = await Promise.all([
    supabase.from("clients").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("projects").select("id, name, client_id").is("deleted_at", null).order("name"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nueva propuesta"
        back={<BackLink href="/proposals" label="Volver a propuestas" />}
      />
      <NewProposalForm
        clients={(clients ?? []) as any}
        projects={(projects ?? []) as any}
        initialClientId={client_id}
        initialProjectId={project_id}
      />
    </div>
  );
}
