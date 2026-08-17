import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopySummaryButton } from "@/components/ui/copy-summary-button";
import { SectionBoundary } from "@/components/ui/error-boundary";
import { MemberLabel } from "@/components/ui/member-avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { isAIEnabled } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { CONVERSION_STEP_LABEL } from "@/lib/conversion-events/labels";
import { formatLeadBriefingForAI } from "@/lib/leads/ai-context";
import { groupResendInteractions } from "@/lib/leads/interaction-utils";
import { getLeadDetail } from "@/lib/leads/queries";
import { leadDisplayName } from "@/lib/leads/utils";
import { listActiveMembers } from "@/lib/members/queries";
import { LEAD_STATUS, TASK_STATUS, type TaskStatus } from "@/lib/status";
import { formatDate, formatEUR, relativeTime } from "@/lib/utils";
import { TaskCreateDialog } from "../../tasks/task-create-dialog";
import { CallInteractionDetails } from "./call-interaction-details";
import { Lead360Timeline } from "./lead-360-timeline";
import { LeadAiPanel } from "./lead-ai-panel";
import { LeadCommercial } from "./lead-commercial";
import {
  LeadAttachmentsSection,
  LeadConversionJourneySection,
  LeadDiagnosticsSection,
  LeadQuickActionsSection,
} from "./lead-detail-async-sections";
import { LeadEditDialog } from "./lead-edit-dialog";
import { LeadNextActionTaskItem } from "./lead-next-action-task-item";
import { LeadNotesDialog } from "./lead-notes-dialog";
import { MomTestChecklist } from "./mom-test-checklist";
import { PhoneQuickActions } from "./phone-actions";
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
  email_scheduled: "Email programado",
  email_delivery_delayed: "Entrega de email retrasada",
  email_failed: "Error al enviar el email",
  email_suppressed: "Email suprimido",
  call: "Llamada",
  meeting: "Reunión",
  note: "Nota",
  owner_change: "Responsable cambiado",
  status_change: "Cambio de estado",
  portal_view: "Portal visto",
  portal_accept: "Propuesta aceptada",
  portal_reject: "Propuesta rechazada",
};

type NextAction = {
  id: string;
  title: string;
  kind: "task" | "reminder";
  when: string | null;
  status: TaskStatus;
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

function hasValue(value: unknown): boolean {
  if (value == null) return false;
  return typeof value === "string" ? value.trim().length > 0 : true;
}

function compactParts(parts: Array<string | null | undefined>): string | null {
  const value = parts.filter(hasValue).join(" · ");
  return value || null;
}

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ feedback?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requireUser();

  const result = await getLeadDetail(id);
  if (!result) notFound();
  const {
    lead,
    interactions,
    linkedClientId,
    linkedClientName,
    proposals,
    projects,
    invoices,
    tasks,
    reminders,
    attachments,
  } = result;

  const aiEnabled = isAIEnabled();
  const canEdit = user.role !== "viewer";
  const members = canEdit ? await listActiveMembers().catch(() => []) : [];
  const nextActions: NextAction[] = [
    ...tasks.map((task) => ({
      id: task.id as string,
      title: task.title as string,
      kind: "task" as const,
      when: (task.due_date as string | null) ?? null,
      status: task.status as TaskStatus,
    })),
    ...reminders.map((reminder) => ({
      id: reminder.id as string,
      title: reminder.title as string,
      kind: "reminder" as const,
      when: reminder.remind_at,
      status: "todo" as TaskStatus,
    })),
  ].sort((a, b) => {
    if (!a.when) return 1;
    if (!b.when) return -1;
    return new Date(a.when).getTime() - new Date(b.when).getTime();
  });

  const canConvert =
    !linkedClientId &&
    lead.status !== "won" &&
    lead.status !== "lost" &&
    lead.status !== "archived";
  const displayName = leadDisplayName(lead);
  const alias = (lead.alias as string | null)?.trim() || null;
  const firstTouch = compactParts([
    lead.first_landing_path,
    lead.first_referrer,
    lead.first_utm_source,
    lead.first_utm_medium,
    lead.first_utm_campaign,
  ]);
  const lastTouch = compactParts([
    lead.last_landing_path,
    lead.last_referrer,
    lead.last_utm_source,
    lead.last_utm_medium,
    lead.last_utm_campaign,
  ]);
  const briefing = formatLeadBriefingForAI({
    lead,
    clientName: linkedClientName,
    interactions,
    proposals,
    projects,
    invoices,
    tasks,
    reminders,
    attachments,
  });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={displayName}
        description={(lead.company as string | null) ?? undefined}
        breadcrumbs={[
          { label: "Leads", href: "/leads" },
          { label: displayName },
          ...(linkedClientId ? [{ label: "Cliente", href: `/clients/${linkedClientId}` }] : []),
        ]}
        actions={
          <>
            <CopySummaryButton
              lines={(() => {
                const parts: string[] = [];
                parts.push(
                  [`🎯 ${displayName}`, lead.company && `— ${lead.company}`]
                    .filter(Boolean)
                    .join(" "),
                );
                parts.push(
                  [
                    `Estado: ${LEAD_STATUS[lead.status]?.label ?? lead.status}`,
                    lead.estimated_value != null && `Valor: ${formatEUR(lead.estimated_value)}`,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                );
                const contact = [
                  lead.email && `Email: ${lead.email}`,
                  lead.phone && `Tel: ${lead.phone}`,
                ].filter(Boolean);
                if (contact.length) parts.push(contact.join(" · "));
                if (lead.assignee?.name) parts.push(`Responsable: ${lead.assignee.name}`);
                return parts;
              })()}
              urlPath={`/leads/${lead.id as string}`}
            />
            {canEdit ? (
              <LeadEditDialog
                members={members}
                lead={{
                  id: lead.id as string,
                  name: lead.name as string,
                  alias: (lead.alias as string | null) ?? null,
                  company: (lead.company as string | null) ?? null,
                  email: (lead.email as string | null) ?? null,
                  phone: (lead.phone as string | null) ?? null,
                  source: (lead.source as string | null) ?? null,
                  notes: (lead.notes as string | null) ?? null,
                  estimated_value:
                    lead.estimated_value != null ? Number(lead.estimated_value) : null,
                  company_size: (lead.company_size as string | null) ?? null,
                  solution_type: (lead.solution_type as string | null) ?? null,
                  urgency: (lead.urgency as string | null) ?? null,
                  assigned_to: (lead.assigned_to as string | null) ?? null,
                  version: Number(lead.version),
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
              leadName={displayName}
            />
          </>
        }
      />

      {canEdit || nextActions.length > 0 ? (
        <NextActionsCard
          canEdit={canEdit}
          leadId={id}
          members={members}
          currentUserId={user.id}
          actions={nextActions}
        />
      ) : null}

      <LeadCommercial
        leadId={lead.id as string}
        linkedClientId={linkedClientId}
        proposals={proposals}
        projects={projects}
        invoices={invoices}
      />

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.75fr)]">
        <Card>
          <CardHeader className="border-b border-border/70 bg-muted/10">
            <CardTitle className="text-base">Contexto del lead</CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              <DetailGrid>
                <DetailRow label="Nombre">{lead.name as string}</DetailRow>
                {alias && <DetailRow label="Alias">{alias}</DetailRow>}
                <DetailRow label="Estado">
                  <StatusBadge meta={LEAD_STATUS} value={lead.status as string} />
                </DetailRow>
                {(lead.status === "lost" || lead.status === "not_interested") &&
                  lead.lost_reason && (
                    <DetailRow label={lead.status === "lost" ? "Motivo de pérdida" : "Motivo"}>
                      <span className="font-medium text-destructive">
                        {lead.lost_reason as string}
                      </span>
                    </DetailRow>
                  )}
                {lead.email && <DetailRow label="Email">{lead.email}</DetailRow>}
                {lead.phone && (
                  <DetailRow label="Teléfono">
                    <PhoneQuickActions
                      phone={lead.phone as string}
                      leadId={lead.id as string}
                      leadName={displayName}
                      leadEmail={(lead.email as string | null) ?? null}
                      firstContactedAt={(lead.first_contacted_at as string | null) ?? null}
                      senderName={user.name}
                    />
                  </DetailRow>
                )}
                {lead.company && <DetailRow label="Empresa">{lead.company}</DetailRow>}
                <DetailRow label="Responsable">
                  <MemberLabel member={lead.assignee} />
                </DetailRow>
              </DetailGrid>

              <DetailGrid>
                {lead.source && <DetailRow label="Origen">{lead.source}</DetailRow>}
                {lead.score != null && (
                  <DetailRow label="Score">{`${Number(lead.score)}/100`}</DetailRow>
                )}
                {lead.estimated_value != null && (
                  <DetailRow label="Valor estimado">
                    {formatEUR(Number(lead.estimated_value))}
                  </DetailRow>
                )}
                <DetailRow label="Creado">{formatDate(lead.created_at as string)}</DetailRow>
                {lead.company_size && <DetailRow label="Tamaño">{lead.company_size}</DetailRow>}
                {lead.urgency && <DetailRow label="Urgencia">{lead.urgency}</DetailRow>}
                {lead.solution_type && <DetailRow label="Solución">{lead.solution_type}</DetailRow>}
                {lead.conversion_step && (
                  <DetailRow label="Conversión">
                    {CONVERSION_STEP_LABEL[lead.conversion_step as string] ?? lead.conversion_step}
                  </DetailRow>
                )}
                {lead.landing_path && <DetailRow label="Landing">{lead.landing_path}</DetailRow>}
                {lead.landing_ref && <DetailRow label="Ref">{lead.landing_ref}</DetailRow>}
                {[lead.calculator_cost, lead.calculator_hours].some(hasValue) && (
                  <DetailRow label="Calculadora">
                    {[lead.calculator_cost, lead.calculator_hours].filter(hasValue).join(" · ")}
                  </DetailRow>
                )}
              </DetailGrid>
            </div>

            {(lead.landing_subject || firstTouch || lastTouch || lead.notes) && (
              <div className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                {lead.landing_subject || firstTouch || lastTouch ? (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {lead.landing_subject ? (
                      <p>
                        <span className="font-medium text-foreground">Asunto:</span>{" "}
                        {lead.landing_subject}
                      </p>
                    ) : null}
                    {firstTouch ? (
                      <p>
                        <span className="font-medium text-foreground">First touch:</span>{" "}
                        {firstTouch}
                      </p>
                    ) : null}
                    {lastTouch ? (
                      <p>
                        <span className="font-medium text-foreground">Last touch:</span> {lastTouch}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <span />
                )}
                {lead.notes ? (
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Notas
                      </h3>
                      <LeadNotesDialog notes={lead.notes as string} />
                    </div>
                    <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm leading-6">
                      {lead.notes as string}
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/70 bg-muted/10">
            <CardTitle className="text-base">Calificación</CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <MomTestChecklist
              leadId={lead.id as string}
              canEdit={canEdit}
              initialValues={{
                real_problem: (lead.mom_test_real_problem as boolean | null) ?? null,
                aware_problem: (lead.mom_test_aware_problem as boolean | null) ?? null,
                tried_solutions: (lead.mom_test_tried_solutions as boolean | null) ?? null,
                decision_power_or_budget:
                  (lead.mom_test_decision_power_or_budget as boolean | null) ?? null,
                accessible: (lead.mom_test_accessible as boolean | null) ?? null,
              }}
            />
          </CardContent>
        </Card>
      </section>

      <Lead360Timeline
        leadId={lead.id as string}
        leadStatus={lead.status as string}
        interactions={interactions}
        proposals={proposals}
        projects={projects}
        invoices={invoices}
        tasks={tasks}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-6">
          <SectionBoundary label="No se pudo cargar el journey de conversión">
            <LeadConversionJourneySection leadId={lead.id} eventId={lead.event_id} />
          </SectionBoundary>

          <SectionBoundary label="No se pudieron cargar los diagnósticos personalizados">
            <LeadDiagnosticsSection leadId={lead.id} />
          </SectionBoundary>

          <SectionBoundary label="No se pudo cargar el análisis IA">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">Análisis IA</CardTitle>
              </CardHeader>
              <CardContent>
                <LeadAiPanel
                  leadId={lead.id as string}
                  aiEnabled={aiEnabled}
                  members={members}
                  briefing={briefing}
                  initialData={{
                    ai_summary: (lead.ai_summary as string | null) ?? null,
                    ai_suggested_next_step: (lead.ai_suggested_next_step as string | null) ?? null,
                    ai_suggested_next_step_at:
                      (lead.ai_suggested_next_step_at as string | null) ?? null,
                    ai_temperature: (lead.ai_temperature as "hot" | "warm" | "cold" | null) ?? null,
                    ai_confidence: (lead.ai_confidence as number | null) ?? null,
                    ai_updated_at: (lead.ai_updated_at as string | null) ?? null,
                    ai_tags: (lead.ai_tags as string[] | null) ?? null,
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
                  {groupResendInteractions(interactions).map(({ interaction: i, count }) => {
                    const type = i.type as string;
                    const subject = i.subject as string | null;
                    const snippet = excerpt(i.body as string | null);
                    return (
                      <li key={i.id as string} className="flex items-start gap-3 px-6 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {INTERACTION_LABEL[type] ?? type}
                            {count > 1 ? ` · ${count} eventos` : null}
                          </p>
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
                          {type === "call" ? <CallInteractionDetails interaction={i} /> : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
          <SectionBoundary label="No se pudieron cargar los adjuntos">
            <LeadAttachmentsSection leadId={lead.id} canEdit={canEdit} />
          </SectionBoundary>
        </div>

        {/* Sidebar */}
        <div className="flex min-w-0 flex-col gap-6">
          <SectionBoundary label="No se pudieron cargar las acciones rápidas">
            <LeadQuickActionsSection
              lead={{
                id: lead.id,
                name: lead.name,
                email: lead.email,
                phone: lead.phone,
                assigned_to: lead.assigned_to,
              }}
              senderName={user.name}
              canEdit={canEdit}
              openCallInitially={query?.feedback === "call"}
              aiEnabled={aiEnabled}
              scheduleMembers={members}
            />
          </SectionBoundary>
        </div>
      </div>
    </div>
  );
}

function NextActionsCard({
  canEdit,
  leadId,
  members,
  currentUserId,
  actions,
}: {
  canEdit: boolean;
  leadId: string;
  members: Awaited<ReturnType<typeof listActiveMembers>>;
  currentUserId: string;
  actions: NextAction[];
}) {
  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Qué hacer ahora</CardTitle>
          <p className="mt-1 text-sm font-normal text-muted-foreground">
            Próximos pasos para mantener el lead en movimiento.
          </p>
        </div>
        {canEdit ? (
          <TaskCreateDialog
            leadId={leadId}
            members={members}
            currentUserId={currentUserId}
            trigger={<Button size="sm">Nueva tarea</Button>}
          />
        ) : null}
      </CardHeader>
      <CardContent className="px-0">
        {actions.length > 0 ? (
          <ul className="divide-y divide-border">
            {actions.map((action) => {
              const overdue = action.when ? new Date(action.when) < new Date() : false;
              if (action.kind === "task" && canEdit) {
                return (
                  <LeadNextActionTaskItem
                    key={`${action.kind}-${action.id}`}
                    task={{
                      ...action,
                      overdue,
                      whenLabel: action.when ? relativeTime(action.when) : null,
                    }}
                    leadId={leadId}
                    members={members}
                    currentUserId={currentUserId}
                  />
                );
              }
              return (
                <li
                  key={`${action.kind}-${action.id}`}
                  className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm"
                >
                  <Link
                    href={`/tasks/${action.id}`}
                    className="min-w-0 truncate font-medium hover:underline"
                  >
                    <span className="mr-2 text-xs text-muted-foreground">
                      {action.kind === "reminder" ? "Aviso" : "Tarea"}
                    </span>
                    {action.title}
                  </Link>
                  <div className="flex shrink-0 items-center gap-3 text-xs">
                    {action.kind === "task" ? (
                      <StatusBadge meta={TASK_STATUS} value={action.status} />
                    ) : null}
                    {action.when ? (
                      <span
                        className={
                          overdue ? "font-medium text-destructive" : "text-muted-foreground"
                        }
                      >
                        {relativeTime(action.when)}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-6 py-2 text-sm text-muted-foreground">Sin acciones pendientes.</p>
        )}
      </CardContent>
    </Card>
  );
}
