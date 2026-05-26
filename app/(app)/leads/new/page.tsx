import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { createLead } from "../actions";
import { LeadFormFields } from "../lead-form-fields";

export const metadata: Metadata = { title: "Nuevo lead · doscientos" };

export default async function NewLeadPage() {
  await requireUser();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nuevo lead"
        description="Registra una nueva oportunidad comercial."
        back={<BackLink href="/leads" label="Volver a leads" />}
      />

      <Card>
        <CardContent className="pt-6">
          <form action={createLead} className="flex flex-col gap-5">
            <LeadFormFields idPrefix="new" autoFocusName />

            <div className="flex items-center justify-end gap-2 border-t border-border pt-5">
              <Button asChild variant="ghost" size="sm">
                <Link href="/leads">Cancelar</Link>
              </Button>
              <SubmitButton pendingLabel="Creando…">Crear lead</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
