import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { GmailSyncForm } from "./gmail-sync-form";

export const metadata = { title: "Integraciones · Ajustes · doscientos" };

export default async function IntegrationsSettingsPage() {
  await requirePageRole(["owner", "admin"]);
  const supabase = await createServerClient();
  const { data: settings } = await supabase
    .from("settings")
    .select("gmail_sync_mailboxes")
    .eq("id", 1)
    .maybeSingle();
  const mailboxes = Array.isArray(settings?.gmail_sync_mailboxes)
    ? settings.gmail_sync_mailboxes.filter((email): email is string => typeof email === "string")
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Integraciones"
        description="Configura los buzones generales y las conexiones del backoffice."
      />
      <Card>
        <CardHeader>
          <CardTitle>Sincronización Gmail de leads</CardTitle>
          <CardDescription>
            Al sincronizar un lead se consultan los buzones de los miembros activos y estos buzones
            generales.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GmailSyncForm mailboxes={mailboxes} />
        </CardContent>
      </Card>
    </div>
  );
}
