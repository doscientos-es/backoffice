import { BackLink } from "@/components/layout/back-link";
import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, relativeTime } from "@/lib/utils";
import { notFound } from "next/navigation";
import { EmailComposer } from "./email-composer";
import { LeadStatusSelect } from "./status-select";

export const dynamic = "force-dynamic";

const STATUS_VARIANT = {
  new: "info",
  qualifying: "warning",
  quoted: "warning",
  won: "success",
  lost: "danger",
  archived: "neutral",
} as const;

const INTERACTION_LABEL: Record<string, string> = {
  email_sent: "Email enviado",
  email_delivered: "Email entregado",
  email_opened: "Email abierto",
  email_clicked: "Email con clic",
  email_bounced: "Email rebotado",
  email_complained: "Email marcado como spam",
  call: "Llamada",
  meeting: "Reunión",
  note: "Nota",
  portal_view: "Portal visto",
  portal_accept: "Propuesta aceptada",
  portal_reject: "Propuesta rechazada",
};

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createServerClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, email, phone, company, source, status, notes, created_at, updated_at")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!lead) notFound();

  const { data: interactions } = await supabase
    .from("lead_interactions")
    .select("id, type, subject, created_at, payload")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const composerDisabled = !user.emailSendEnabled || !user.emailAlias;
  const composerReason = !user.emailAlias
    ? "Configura un alias de email en Ajustes para enviar correos."
    : !user.emailSendEnabled
      ? "Activa el envío de emails en Ajustes."
      : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={lead.name as string}
        description={(lead.company as string | null) ?? undefined}
        back={<BackLink href="/leads" label="Volver a leads" />}
        actions={<LeadStatusSelect leadId={lead.id as string} status={lead.status as string} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Detalles</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailGrid>
              <DetailRow label="Estado">
                <Badge variant={STATUS_VARIANT[lead.status as keyof typeof STATUS_VARIANT]}>
                  {lead.status as string}
                </Badge>
              </DetailRow>
              <DetailRow label="Email">{(lead.email as string | null) ?? "—"}</DetailRow>
              <DetailRow label="Teléfono">{(lead.phone as string | null) ?? "—"}</DetailRow>
              <DetailRow label="Empresa">{(lead.company as string | null) ?? "—"}</DetailRow>
              <DetailRow label="Origen">{(lead.source as string | null) ?? "—"}</DetailRow>
              <DetailRow label="Creado">{formatDate(lead.created_at as string)}</DetailRow>
            </DetailGrid>

            {lead.notes ? (
              <div className="mt-5 border-t border-border pt-4">
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Notas
                </h3>
                <p className="whitespace-pre-wrap text-sm">{lead.notes as string}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Enviar email</CardTitle>
          </CardHeader>
          <CardContent>
            <EmailComposer
              leadId={lead.id as string}
              defaultTo={(lead.email as string | null) ?? ""}
              disabled={composerDisabled || !lead.email}
              disabledReason={!lead.email ? "Este lead no tiene email." : composerReason}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {!interactions || interactions.length === 0 ? (
            <p className="px-6 py-2 text-sm text-muted-foreground">
              Sin interacciones registradas.
            </p>
          ) : (
            <ol className="divide-y divide-border">
              {interactions.map((i) => (
                <li key={i.id as string} className="flex items-start gap-3 px-6 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {INTERACTION_LABEL[i.type as string] ?? (i.type as string)}
                    </p>
                    {i.subject ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {i.subject as string}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {relativeTime(i.created_at as string)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
