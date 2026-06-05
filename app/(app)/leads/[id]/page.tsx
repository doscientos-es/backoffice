import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionBoundary } from "@/components/ui/error-boundary";
import { MemberLabel } from "@/components/ui/member-avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { isAIEnabled } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { getLeadDetail } from "@/lib/leads/queries";
import { listActiveMembers } from "@/lib/members/queries";
import { LEAD_STATUS } from "@/lib/status";
import { formatDate, formatEUR, relativeTime } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadAiPanel } from "./lead-ai-panel";
import { LeadEditDialog } from "./lead-edit-dialog";
import { LeadOwnerSelect } from "./owner-select";
import { LeadQuickActions } from "./quick-actions";
import { LeadStatusSelect } from "./status-select";

export const dynamic = "force-dynamic";

const INTERACTION_LABEL: Record<string, string> = {
  email_sent: "Email enviado",
  email_received: "Email recibido",
  email_delivered: "Email entregado",
  email_opened: "Email abierto",
  email_clicked: "Email con clic",
  email_bounced: "Email rebotado",
  email_complained: "Email marcado como spam",
  call: "Llamada",
  meeting: "Reunión",
  note: "Nota",
  owner_change: "Responsable cambiado",
  status_change: "Cambio de estado",
  portal_view: "Portal visto",
  portal_accept: "Propuesta aceptada",
  portal_reject: "Propuesta rechazada",
};

/**
 * Recorta el cuerpo de la interacción para mostrarlo en el timeline.
 * Acepta HTML (emails) y texto plano (notas, transcripciones).
 */
function excerpt(body: string | null, max = 160): string | null {
  if (!body) return null;
  const text = body
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const result = await getLeadDetail(id);
  if (!result) notFound();
  const { lead, interactions, linkedClientId } = result;

  const aiEnabled = isAIEnabled();
  const canEdit = user.role !== "viewer";
  const members = canEdit ? await listActiveMembers() : [];
  const canConvert =
    !linkedClientId &&
    lead.status !== "won" &&
    lead.status !== "lost" &&
    lead.status !== "archived";
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={lead.name as string}
        description={(lead.company as string | null) ?? undefined}
        breadcrumbs={[
          { label: "Leads", href: "/leads" },
          { label: lead.name as string },
          ...(linkedClientId ? [{ label: "Cliente", href: `/clients/${linkedClientId}` }] : []),
        ]}
        actions={
          <>
            {canEdit ? (
              <LeadEditDialog
                lead={{
                  id: lead.id as string,
                  name: lead.name as string,
                  company: (lead.company as string | null) ?? null,
                  email: (lead.email as string | null) ?? null,
                  phone: (lead.phone as string | null) ?? null,
                  source: (lead.source as string | null) ?? null,
                  notes: (lead.notes as string | null) ?? null,
                  estimated_value:
                    lead.estimated_value != null ? Number(lead.estimated_value) : null,
                }}
              />
            ) : null}
            {canConvert ? (
              <Button asChild size="sm">
                <Link href={`/leads/${lead.id}/convert`}>Convertir a cliente</Link>
              </Button>
            ) : linkedClientId ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/clients/${linkedClientId}`}>Ver cliente</Link>
              </Button>
            ) : null}
            <LeadStatusSelect
              leadId={lead.id as string}
              status={lead.status as string}
              leadName={lead.name as string}
            />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Detalles</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailGrid>
                <DetailRow label="Estado">
                  <div className="flex items-center gap-2">
                    <StatusBadge meta={LEAD_STATUS} value={lead.status as string} />
                    {lead.status === "lost" && lead.lost_reason && (
                      <Badge variant="outline" className="text-muted-foreground border-dashed">
                        {lead.lost_reason as string}
                      </Badge>
                    )}
                  </div>
                </DetailRow>
                <DetailRow label="Email">{(lead.email as string | null) ?? "—"}</DetailRow>
                <DetailRow label="Teléfono">{(lead.phone as string | null) ?? "—"}</DetailRow>
                <DetailRow label="Empresa">{(lead.company as string | null) ?? "—"}</DetailRow>
                <DetailRow label="Origen">{(lead.source as string | null) ?? "—"}</DetailRow>
                <DetailRow label="Responsable">
                  {canEdit ? (
                    <LeadOwnerSelect
                      leadId={lead.id as string}
                      assignedTo={(lead.assigned_to as string | null) ?? null}
                      members={members}
                    />
                  ) : (
                    <MemberLabel member={lead.assignee} />
                  )}
                </DetailRow>
                <DetailRow label="Valor estimado">
                  {lead.estimated_value != null ? formatEUR(Number(lead.estimated_value)) : "—"}
                </DetailRow>
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

          <SectionBoundary label="No se pudo cargar el análisis IA">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">Análisis IA</CardTitle>
              </CardHeader>
              <CardContent>
                <LeadAiPanel
                  leadId={lead.id as string}
                  aiEnabled={aiEnabled}
                  initialData={{
                    ai_summary: (lead.ai_summary as string | null) ?? null,
                    ai_suggested_next_step: (lead.ai_suggested_next_step as string | null) ?? null,
                    ai_temperature: (lead.ai_temperature as "hot" | "warm" | "cold" | null) ?? null,
                    ai_confidence: (lead.ai_confidence as number | null) ?? null,
                    ai_updated_at: (lead.ai_updated_at as string | null) ?? null,
                  }}
                />
              </CardContent>
            </Card>
          </SectionBoundary>

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
                  {interactions.map((i) => {
                    const type = i.type as string;
                    const subject = i.subject as string | null;
                    const snippet = excerpt(i.body as string | null);
                    return (
                      <li key={i.id as string} className="flex items-start gap-3 px-6 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{INTERACTION_LABEL[type] ?? type}</p>
                          {subject ? (
                            <p className="truncate text-xs text-muted-foreground">{subject}</p>
                          ) : null}
                          {snippet ? (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/90">
                              {snippet}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-0.5 text-xs text-muted-foreground">
                          <span className="tabular-nums">
                            {relativeTime(i.created_at as string)}
                          </span>
                          {i.performer ? (
                            <MemberLabel
                              member={i.performer}
                              size="xs"
                              className="gap-1 text-[11px] text-muted-foreground/70"
                            />
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
          <Card className="lg:sticky lg:top-6">
            <CardHeader>
              <CardTitle>Acciones rápidas</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadQuickActions
                leadId={lead.id as string}
                leadName={lead.name as string}
                leadEmail={(lead.email as string | null) ?? null}
                leadPhone={(lead.phone as string | null) ?? null}
                claimable={canEdit && !lead.assigned_to}
                aiEnabled={aiEnabled}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
