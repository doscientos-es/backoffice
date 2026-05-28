import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import type { Metadata } from "next";
import { LeadNewForm } from "./lead-new-form";

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
          <LeadNewForm />
        </CardContent>
      </Card>
    </div>
  );
}
