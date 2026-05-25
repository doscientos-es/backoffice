import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { updateCompanySettings, updateProfile } from "./actions";

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
          <form action={updateProfile} className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Nombre</Label>
                <Input value={user.name} disabled />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Email</Label>
                <Input value={user.email} disabled />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email_alias" className="text-xs font-medium">Alias de envío</Label>
                <Input id="email_alias" name="email_alias" type="email"
                  defaultValue={user.emailAlias ?? ""} placeholder="notificaciones@empresa.com" />
              </div>
              <div className="flex flex-col gap-1.5 justify-center pt-4">
                <Label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" name="email_send_enabled" value="on"
                    defaultChecked={user.emailSendEnabled}
                    className="h-4 w-4 rounded border-border" />
                  Activar envío de emails
                </Label>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="signature_html" className="text-xs font-medium">
                Firma HTML
              </Label>
              <Textarea id="signature_html" name="signature_html" rows={5}
                defaultValue={user.signatureHtml ?? ""}
                placeholder="<p>Un saludo,<br/><strong>Tu Nombre</strong></p>" />
            </div>
            <div className="flex justify-end border-t border-border pt-4">
              <Button type="submit" size="sm">Guardar perfil</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Company */}
      <Card>
        <CardHeader>
          <CardTitle>Empresa</CardTitle>
          <CardDescription>Datos fiscales que aparecen en facturas y propuestas.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateCompanySettings} className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="company_name" className="text-xs font-medium">Razón social</Label>
                <Input id="company_name" name="company_name" required
                  defaultValue={(settings?.company_name as string | null) ?? ""} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="company_nif" className="text-xs font-medium">NIF</Label>
                <Input id="company_nif" name="company_nif"
                  defaultValue={(settings?.company_nif as string | null) ?? ""} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invoice_series" className="text-xs font-medium">Serie factura</Label>
                <Input id="invoice_series" name="invoice_series" maxLength={10}
                  defaultValue={(settings?.invoice_series as string | null) ?? "A"} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="default_vat_rate" className="text-xs font-medium">IVA por defecto (%)</Label>
                <Input id="default_vat_rate" name="default_vat_rate" type="number"
                  min="0" max="100" step="0.01"
                  defaultValue={(settings?.default_vat_rate as number | null) ?? 21} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="iban" className="text-xs font-medium">IBAN</Label>
                <Input id="iban" name="iban"
                  defaultValue={(settings?.iban as string | null) ?? ""} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company_address" className="text-xs font-medium">Dirección fiscal</Label>
              <Textarea id="company_address" name="company_address" rows={2}
                defaultValue={(settings?.company_address as string | null) ?? ""} />
            </div>
            <div className="flex justify-end border-t border-border pt-4">
              <Button type="submit" size="sm">Guardar empresa</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
