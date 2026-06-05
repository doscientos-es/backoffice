import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import type { Metadata } from "next";
import { listEmailTemplates } from "./actions";
import { EmailTemplatesManager } from "./email-templates-manager";

export const metadata: Metadata = { title: "Plantillas de email · Ajustes · doscientos" };
export const dynamic = "force-dynamic";

export default async function EmailTemplatesPage() {
  const templates = await listEmailTemplates();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Plantillas de email"
        description="Gestiona las plantillas reutilizables para enviar emails a leads desde el CRM."
      />
      <Card>
        <CardContent className="pt-6">
          <EmailTemplatesManager templates={templates} />
        </CardContent>
      </Card>
    </div>
  );
}
