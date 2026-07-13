import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { WebFormFields } from "../_components/web-form-fields";
import { createWebProject } from "../actions";

export const metadata: Metadata = { title: "Nueva web · doscientos" };
export const dynamic = "force-dynamic";

export default async function NewWebPage() {
  await requireUser();
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
          <form action={createWebProject} className="flex flex-col gap-5">
            <WebFormFields
              idPrefix="new"
              clients={(clients as Array<{ id: string; name: string }> | null) ?? []}
              autoFocusName
            />
            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button asChild variant="ghost" size="sm">
                <Link href="/webs">Cancelar</Link>
              </Button>
              <SubmitButton pendingLabel="Guardando…">Crear web</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
