import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { CopySummaryButton } from "@/components/ui/copy-summary-button";
import { SectionBoundary } from "@/components/ui/error-boundary";
import { MemberLabel } from "@/components/ui/member-avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { isAIEnabled } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { CONVERSION_STEP_LABEL } from "@/lib/conversion-events/labels";
import { serverEnv } from "@/lib/env";
import { formatLeadBriefingForAI } from "@/lib/leads/ai-context";
import { requiresCyaProspectSoftwareCommission } from "@/lib/leads/attribution";
import { suggestedCallDurationMinutes } from "@/lib/leads/meeting-duration";
import { getLeadDetail } from "@/lib/leads/queries";
import type { LeadCompanyResearch as LeadCompanyResearchData } from "@/lib/leads/types";
import { leadDisplayName } from "@/lib/leads/utils";
import { listActiveMembers } from "@/lib/members/queries";
import { LEAD_STATUS, TASK_STATUS, type TaskStatus } from "@/lib/status";
import { formatDate, formatEUR, relativeTime } from "@/lib/utils";

import { buildAdsManagerUrl } from "../../marketing/_components/marketing-format";
import { AdPreviewDialog } from "../../marketing/ad-preview-dialog";
import { TaskCreateDialog } from "../../tasks/task-create-dialog";
import { LeadActivityFeed, countActivityEvents } from "./lead-activity-feed";
import { LeadAiPanel } from "./lead-ai-panel";
import { LeadCommercial } from "./lead-commercial";
import { LeadCompanyResearch } from "./lead-company-research";
import {
  LeadAttachmentsSection,
  LeadConversionJourneySection,
  LeadDiagnosticsSection,
  LeadQuickActionsSection,
} from "./lead-detail-async-sections";
import { LeadDetailTabs, resolveLeadTab } from "./lead-detail-tabs";
import { LeadDiscoveryQuestionsPanel } from "./lead-discovery-questions-panel";
import { LeadEditDialog } from "./lead-edit-dialog";
import { LeadLanguageSelect } from "./lead-language-select";
import { LeadNextActionReminderItem } from "./lead-next-action-reminder-item";
import { LeadNextActionTaskItem } from "./lead-next-action-task-item";
import { LeadNextMove } from "./lead-next-move";
import { LeadNotesDialog } from "./lead-notes-dialog";
import { LeadRecentInteractions } from "./lead-recent-interactions";
import { MomTestChecklist } from "./mom-test-checklist";
import { PhoneQuickActions } from "./phone-actions";
import { LeadStatusSelect } from "./status-select";

export const dynamic = "force-dynamic";

type NextAction = {
  id: string;
  title: string;
  kind: "task" | "reminder";
  when: string | null;
  status: TaskStatus;
};

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
  searchParams?: Promise<{
    feedback?: string;
    tab?: string;
    callSessionId?: string;
    duration?: string;
    outcome?: string;
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const tab = resolveLeadTab(query?.tab);
  const user = await requireUser();

  const result = await getLeadDetail(id);
  if (!result) notFound();
  const {
    lead,
    companyResearchAvailable,
    interactions,
    linkedClientId,
    linkedClientName,
    proposals,
    projects,
    invoices,
    tasks,
    reminders,
    attachments,
    discoveryQuestions,
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

  const displayName = leadDisplayName(lead);
  const alias = (lead.alias as string | null)?.trim() || null;
  const campaignName = lead.marketing_campaign_name;
  const metaAdId = lead.source === "Anuncios Meta" ? lead.utm_content : null;
  const metaAdName = lead.marketing_ad_name ?? (metaAdId ? `Anuncio ${metaAdId}` : null);
  const adsManagerUrl = metaAdId
    ? buildAdsManagerUrl(metaAdId, serverEnv().META_AD_ACCOUNT_ID || null)
    : null;
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
    discoveryQuestions,
  });
  const defaultDurationMinutes = suggestedCallDurationMinutes(interactions);
  const sessionDuration = Number(query?.duration);
  const callSessionDuration =
    Number.isInteger(sessionDuration) && sessionDuration >= 0 && sessionDuration <= 600
      ? sessionDuration
      : null;
  const callSessionOutcome =
    query?.outcome === "connected" || query?.outcome === "no_answer" ? query.outcome : undefined;
  const callSessionId =
    query?.callSessionId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      query.callSessionId,
    )
      ? query.callSessionId
      : undefined;
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
              <div className="flex items-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/document-templates/generate?lead_id=${lead.id as string}`}>
                    Crear documento
                  </Link>
                </Button>
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
                    language: (lead.language as "es" | "ca" | "en" | null) ?? null,
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
              </div>
            ) : null}
            <LeadLanguageSelect
              leadId={lead.id as string}
              leadName={lead.name as string}
              version={Number(lead.version)}
              language={(lead.language as string | null) ?? null}
            />
            {linkedClientId ? (
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

      <LeadDetailTabs
        leadId={id}
        current={tab}
        counts={{
          actividad: interactions?.length ?? 0,
          comercial: proposals.length + projects.length + invoices.length,
        }}
      />

      <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="order-2 flex min-w-0 flex-col gap-6 lg:order-1">
          {tab === "resumen" ? (
            <>
              <LeadDiscoveryQuestionsPanel
                leadId={lead.id as string}
                initialQuestions={discoveryQuestions}
                aiEnabled={aiEnabled}
                canEdit={canEdit}
              />
              <Card>
                <CardContent className="pt-5">
                  <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
                    <section className="min-w-0">
                      <h3 className="mb-4 text-sm font-semibold">Contacto</h3>
                      <DetailGrid className="grid-cols-[90px_minmax(0,1fr)] gap-x-3 gap-y-3 text-[13px]">
                        {alias && <DetailRow label="Alias">{alias}</DetailRow>}
                        <DetailRow label="Estado">
                          <StatusBadge meta={LEAD_STATUS} value={lead.status as string} />
                        </DetailRow>
                        {(lead.status === "lost" || lead.status === "not_interested") &&
                          lead.lost_reason && (
                            <DetailRow
                              label={lead.status === "lost" ? "Motivo de pérdida" : "Motivo"}
                            >
                              <span className="font-medium text-destructive">
                                {lead.lost_reason as string}
                              </span>
                            </DetailRow>
                          )}
                        {lead.email && (
                          <DetailRow label="Email">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <a
                                href={`mailto:${lead.email as string}`}
                                className="min-w-0 break-all text-primary underline-offset-2 hover:underline"
                              >
                                {lead.email as string}
                              </a>
                              <CopyButton
                                text={lead.email as string}
                                successMessage="Email copiado"
                                label="Copiar email"
                                className="shrink-0"
                              />
                            </div>
                          </DetailRow>
                        )}
                        {lead.phone && (
                          <DetailRow label="Teléfono">
                            <PhoneQuickActions
                              phone={lead.phone as string}
                              leadId={lead.id as string}
                              leadName={displayName}
                              leadEmail={(lead.email as string | null) ?? null}
                              leadLanguage={(lead.language as string | null) ?? null}
                              firstContactedAt={(lead.first_contacted_at as string | null) ?? null}
                              senderName={user.name}
                              aiEnabled={aiEnabled}
                            />
                          </DetailRow>
                        )}
                        {lead.company && <DetailRow label="Empresa">{lead.company}</DetailRow>}
                        <DetailRow label="Responsable">
                          <MemberLabel member={lead.assignee} />
                        </DetailRow>
                      </DetailGrid>
                    </section>

                    <section className="min-w-0">
                      <h3 className="mb-4 text-sm font-semibold">Oportunidad</h3>
                      <DetailGrid className="grid-cols-[100px_minmax(0,1fr)] gap-x-3 gap-y-3 text-[13px]">`r`n                        <DetailRow label="Estado">
                          <StatusBadge meta={LEAD_STATUS} value={lead.status as string} />
                        </DetailRow>
                        {lead.score != null && (
                          <DetailRow label="Score">{`${Number(lead.score)}/100`}</DetailRow>
                        )}
                        {lead.estimated_value != null && (
                          <DetailRow label="Valor estimado">
                            {formatEUR(Number(lead.estimated_value))}
                          </DetailRow>
                        )}
                        <DetailRow label="Creado">
                          {formatDate(lead.created_at as string)}
                        </DetailRow>
                        {lead.company_size && (
                          <DetailRow label="Tamaño">{lead.company_size}</DetailRow>
                        )}
                        {lead.urgency && <DetailRow label="Urgencia">{lead.urgency}</DetailRow>}
                        {lead.solution_type && (
                          <DetailRow label="Solución">{lead.solution_type}</DetailRow>
                        )}
                      </DetailGrid>
                    </section>

                    <section className="min-w-0">
                      <h3 className="mb-4 text-sm font-semibold">Captación</h3>
                      <DetailGrid className="grid-cols-[90px_minmax(0,1fr)] gap-x-3 gap-y-3 text-[13px]">
                        {lead.source && <DetailRow label="Origen">{lead.source}</DetailRow>}
                        {campaignName && <DetailRow label="Campaña Meta">{campaignName}</DetailRow>}
                        {metaAdId && metaAdName && (
                          <DetailRow label="Anuncio Meta">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {adsManagerUrl ? (
                                <a
                                  href={adsManagerUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-primary hover:underline"
                                  title={`ID de anuncio: ${metaAdId}`}
                                >
                                  {metaAdName}
                                  <ExternalLink className="size-3.5" />
                                </a>
                              ) : (
                                <span title={`ID de anuncio: ${metaAdId}`}>{metaAdName}</span>
                              )}
                              <AdPreviewDialog
                                adId={metaAdId}
                                adName={metaAdName}
                                campaignName={campaignName ?? "Sin campaña"}
                                adsManagerUrl={adsManagerUrl}
                              />
                            </div>
                          </DetailRow>
                        )}
                        {requiresCyaProspectSoftwareCommission(campaignName) && (
                          <DetailRow label="Comisión">
                            <span className="font-medium text-warning">
                              CYA · 20 % de lo ganado
                            </span>
                          </DetailRow>
                        )}
                        {lead.conversion_step && (
                          <DetailRow label="Conversión">
                            {CONVERSION_STEP_LABEL[lead.conversion_step as string] ??
                              lead.conversion_step}
                          </DetailRow>
                        )}
                        {lead.landing_path && (
                          <DetailRow label="Landing">{lead.landing_path}</DetailRow>
                        )}
                        {lead.landing_ref && <DetailRow label="Ref">{lead.landing_ref}</DetailRow>}
                        {[lead.calculator_cost, lead.calculator_hours].some(hasValue) && (
                          <DetailRow label="Calculadora">
                            {[lead.calculator_cost, lead.calculator_hours]
                              .filter(hasValue)
                              .join(" · ")}
                          </DetailRow>
                        )}
                      </DetailGrid>
                    </section>
                  </div>

                  {(lead.landing_subject || firstTouch || lastTouch || lead.notes) && (
                    <div className="mt-8 grid gap-6 border-t border-border pt-6 sm:grid-cols-2">
                      {lead.landing_subject || firstTouch || lastTouch ? (
                        <section className="min-w-0">
                          <h3 className="mb-2 text-sm font-semibold">Recorrido</h3>
                          <div className="space-y-2 text-xs leading-5 text-muted-foreground">
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
                                <span className="font-medium text-foreground">Last touch:</span>{" "}
                                {lastTouch}
                              </p>
                            ) : null}
                          </div>
                        </section>
                      ) : (
                        <span />
                      )}
                      {lead.notes ? (
                        <section className="min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold">Notas</h3>
                            <LeadNotesDialog notes={lead.notes as string} />
                          </div>
                          <p className="mt-2 line-clamp-5 text-sm leading-6 whitespace-pre-wrap">
                            {lead.notes as string}
                          </p>
                        </section>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>

              {canEdit || nextActions.length > 0 ? (
                <NextActionsCard
                  canEdit={canEdit}
                  leadId={id}
                  members={members}
                  currentUserId={user.id}
                  actions={nextActions}
                />
              ) : null}

              <LeadRecentInteractions
                leadId={lead.id as string}
                leadName={displayName}
                leadEmail={(lead.email as string | null) ?? null}
                leadPhone={(lead.phone as string | null) ?? null}
                leadLanguage={(lead.language as string | null) ?? null}
                senderName={user.name}
                canEdit={canEdit}
                aiEnabled={aiEnabled}
                defaultDurationMinutes={defaultDurationMinutes}
                interactions={interactions ?? []}
                totalActivityEvents={countActivityEvents({
                  interactions: interactions ?? [],
                  proposals,
                  invoices,
                  tasks,
                })}
              />
            </>
          ) : null}

          {tab === "actividad" ? (
            <>
              <LeadActivityFeed
                leadId={lead.id as string}
                leadEmail={(lead.email as string | null) ?? null}
                leadLanguage={(lead.language as string | null) ?? null}
                canEdit={canEdit}
                aiEnabled={aiEnabled}
                interactions={interactions ?? []}
                proposals={proposals}
                invoices={invoices}
                tasks={tasks}
              />

              <SectionBoundary label="No se pudieron cargar los adjuntos">
                <LeadAttachmentsSection leadId={lead.id} canEdit={canEdit} />
              </SectionBoundary>
            </>
          ) : null}

          {tab === "comercial" ? (
            <>
              <LeadCommercial
                leadId={lead.id as string}
                linkedClientId={linkedClientId}
                proposals={proposals}
                projects={projects}
                invoices={invoices}
              />

              <SectionBoundary label="No se pudo cargar el journey de conversión">
                <LeadConversionJourneySection leadId={lead.id} eventId={lead.event_id} />
              </SectionBoundary>
            </>
          ) : null}

          {tab === "inteligencia" ? (
            <>
              <SectionBoundary label="No se pudo cargar la inteligencia de empresa">
                <Card>
                  <CardContent className="pt-6">
                    <LeadCompanyResearch
                      leadId={lead.id as string}
                      email={(lead.email as string | null) ?? null}
                      canEdit={canEdit}
                      aiEnabled={aiEnabled}
                      available={companyResearchAvailable}
                      initialResearch={
                        (lead.company_research as LeadCompanyResearchData | null) ?? null
                      }
                      initialResearchedAt={(lead.company_researched_at as string | null) ?? null}
                    />
                  </CardContent>
                </Card>
              </SectionBoundary>

              <SectionBoundary label="No se pudo cargar el análisis IA">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Análisis IA</CardTitle>
                    <p className="mt-1 text-sm font-normal text-muted-foreground">
                      Resumen, señales y siguiente mejor acción.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <LeadAiPanel
                      leadId={lead.id as string}
                      aiEnabled={aiEnabled}
                      members={members}
                      briefing={briefing}
                      initialData={{
                        ai_summary: (lead.ai_summary as string | null) ?? null,
                        ai_suggested_next_step:
                          (lead.ai_suggested_next_step as string | null) ?? null,
                        ai_suggested_next_step_at:
                          (lead.ai_suggested_next_step_at as string | null) ?? null,
                        ai_temperature:
                          (lead.ai_temperature as "hot" | "warm" | "cold" | null) ?? null,
                        ai_confidence: (lead.ai_confidence as number | null) ?? null,
                        ai_updated_at: (lead.ai_updated_at as string | null) ?? null,
                        ai_tags: (lead.ai_tags as string[] | null) ?? null,
                      }}
                    />
                  </CardContent>
                </Card>
              </SectionBoundary>

              <SectionBoundary label="No se pudieron cargar los diagnósticos personalizados">
                <LeadDiagnosticsSection leadId={lead.id} />
              </SectionBoundary>
            </>
          ) : null}
        </div>

        <aside className="order-1 min-w-0 lg:order-2">
          <div className="flex flex-col gap-6 lg:sticky lg:top-6">
            <SectionBoundary label="No se pudieron cargar las acciones rápidas">
              <LeadQuickActionsSection
                lead={{
                  id: lead.id,
                  name: lead.name,
                  email: lead.email,
                  phone: lead.phone,
                  language: lead.language,
                  assigned_to: lead.assigned_to,
                }}
                senderName={user.name}
                canEdit={canEdit}
                openCallInitially={query?.feedback === "call"}
                openScheduleInitially={query?.feedback === "schedule"}
                defaultDurationMinutes={callSessionDuration ?? defaultDurationMinutes}
                defaultCallOutcome={callSessionOutcome}
                callSessionId={callSessionId}
                aiEnabled={aiEnabled}
                scheduleMembers={members}
              />
            </SectionBoundary>

            <SectionBoundary label="No se pudo actualizar la calificación">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Calificación</CardTitle>
                  <CardAction>
                    <div id="mom-test-score" />
                  </CardAction>
                </CardHeader>
                <CardContent className="pt-0">
                  <MomTestChecklist
                    leadId={lead.id as string}
                    canEdit={canEdit}
                    scoreSlotId="mom-test-score"
                    initialValues={{
                      real_problem: (lead.mom_test_real_problem as boolean | null) ?? null,
                      aware_problem: (lead.mom_test_aware_problem as boolean | null) ?? null,
                      tried_solutions: (lead.mom_test_tried_solutions as boolean | null) ?? null,
                      decision_power_or_budget:
                        (lead.mom_test_decision_power_or_budget as boolean | null) ?? null,
                      accessible: (lead.mom_test_accessible as boolean | null) ?? null,
                      comparing_other_companies:
                        (lead.mom_test_comparing_other_companies as boolean | null) ?? null,
                    }}
                  />
                </CardContent>
              </Card>
            </SectionBoundary>

            <LeadNextMove
              leadId={lead.id as string}
              leadStatus={lead.status as string}
              firstContactedAt={lead.first_contacted_at}
              phone={lead.phone}
              reminders={reminders}
              interactions={interactions ?? []}
              proposals={proposals}
              projects={projects}
              invoices={invoices}
            />
          </div>
        </aside>
      </section>
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
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <div>
          <CardTitle className="text-base">Siguiente paso</CardTitle>
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
      <CardContent className="px-0 pt-0">
        {actions.length > 0 ? (
          <ul className="divide-y divide-border">
            {actions.map((action) => {
              const overdue = action.when ? new Date(action.when) < new Date() : false;
              const whenLabel = action.when ? relativeTime(action.when) : null;
              if (action.kind === "task" && canEdit) {
                return (
                  <LeadNextActionTaskItem
                    key={`${action.kind}-${action.id}`}
                    task={{ ...action, overdue, whenLabel }}
                    leadId={leadId}
                    members={members}
                    currentUserId={currentUserId}
                  />
                );
              }
              if (action.kind === "reminder" && canEdit) {
                return (
                  <LeadNextActionReminderItem
                    key={`${action.kind}-${action.id}`}
                    reminder={{ id: action.id, title: action.title, whenLabel, overdue }}
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
                    {whenLabel ? (
                      <span
                        className={
                          overdue ? "font-medium text-destructive" : "text-muted-foreground"
                        }
                      >
                        {whenLabel}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-6 pb-4 text-sm text-muted-foreground">
            Crea una tarea o un recordatorio para dejar claro qué toca hacer después.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
