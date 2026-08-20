import type { Metadata } from "next";
import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePageRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { VerifiedWebProjectForm } from "../_components/verified-web-project-form";

export const metadata: Metadata = { title: "Nueva web · doscientos" };
export const dynamic = "force-dynamic";

export default async function NewWebPage() {
  await requirePageRole(["owner", "admin"]);
  const supabase = await createServerClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .is("deleted_at", null)
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nueva web" back={<BackLink href="/webs" label="Volver a webs" />} />
      <Card>
        <CardContent className="pt-6">
          <VerifiedWebProjectForm
            clients={(clients as Array<{ id: string; name: string }> | null) ?? []}
            mode="create"
          />
        </CardContent>
      </Card>
    </div>
  );
}
