import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { CompanyForm } from "./company-form";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Ajustes · doscientos" };

export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createServerClient();
  const { data: settings } = await supabase.from("settings").select("*").eq("id", 1).single();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Ajustes" />

      {/* Profile / Email */}
      <Card>
        <CardHeader>
          <CardTitle>Perfil y email</CardTitle>
          <CardDescription>Alias de remitente y firma HTML para tus correos.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            name={user.name}
            email={user.email}
            emailAlias={user.emailAlias ?? null}
            emailSendEnabled={user.emailSendEnabled}
            signatureHtml={user.signatureHtml ?? null}
          />
        </CardContent>
      </Card>

      {/* Company */}
      <Card>
        <CardHeader>
          <CardTitle>Empresa</CardTitle>
          <CardDescription>Datos fiscales que aparecen en facturas y propuestas.</CardDescription>
        </CardHeader>
        <CardContent>
          <CompanyForm
            companyName={(settings?.company_name as string | null) ?? ""}
            companyNif={(settings?.company_nif as string | null) ?? ""}
            invoiceSeries={(settings?.invoice_series as string | null) ?? "A"}
            defaultVatRate={(settings?.default_vat_rate as number | null) ?? 21}
            iban={(settings?.iban as string | null) ?? ""}
            companyAddress={(settings?.company_address as string | null) ?? ""}
          />
        </CardContent>
      </Card>
    </div>
  );
}
