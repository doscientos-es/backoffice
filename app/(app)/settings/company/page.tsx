import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { CompanyForm } from "../company-form";

export const metadata = { title: "Empresa · Ajustes · doscientos" };

export default async function CompanySettingsPage() {
  await requireUser();
  const supabase = await createServerClient();
  const { data: settings } = await supabase.from("settings").select("*").eq("id", 1).single();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Empresa"
        description="Datos fiscales que aparecen en facturas y propuestas."
      />
      <Card>
        <CardContent className="pt-6">
          <CompanyForm
            companyName={(settings?.company_name as string | null) ?? ""}
            companyNif={(settings?.company_nif as string | null) ?? ""}
            invoiceSeries={(settings?.invoice_series as string | null) ?? "A"}
            defaultVatRate={(settings?.default_vat_rate as number | null) ?? 21}
            iban={(settings?.iban as string | null) ?? ""}
            companyAddress={(settings?.company_address as string | null) ?? ""}
            internalHourlyCost={(settings?.internal_hourly_cost as number | null) ?? 0}
          />
        </CardContent>
      </Card>
    </div>
  );
}
