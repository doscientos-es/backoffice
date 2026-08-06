import { createTask } from "@/app/(app)/tasks/actions";
import { type AttachmentItem, AttachmentSection } from "@/components/ui/attachment-section";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CONVERSION_EVENT_LABEL, CONVERSION_STEP_LABEL } from "@/lib/conversion-events/labels";
import { listLeadConversionEvents } from "@/lib/conversion-events/queries";
import { listLeadDiagnostics } from "@/lib/diagnostics/queries";
import { isGoogleEnabled } from "@/lib/env";
import type { MemberOption } from "@/lib/members/queries";
import { createServerClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import { LeadQuickActions } from "./quick-actions";

export async function LeadConversionJourneySection({
  leadId,
  eventId,
}: {
  leadId: string;
  eventId: string | null;
}) {
  const events = await listLeadConversionEvents({ id: leadId, event_id: eventId });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Journey de conversión</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin eventos de landing vinculados a este lead.
          </p>
        ) : (
          <ol className="divide-y divide-border">
            {events.map((event) => (
              <li key={event.id} className="grid gap-2 py-3 sm:grid-cols-[160px_1fr]">
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(event.created_at)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={event.event_name.includes("whatsapp") ? "success" : "neutral"}>
                      {CONVERSION_EVENT_LABEL[event.event_name] ?? event.event_name}
                    </Badge>
                    {event.conversion_step && (
                      <span className="text-xs text-muted-foreground">
                        {CONVERSION_STEP_LABEL[event.conversion_step] ?? event.conversion_step}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm">
                    {event.landing_path ?? event.referrer ?? "Evento sin página"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[event.utm_source, event.utm_medium, event.utm_campaign]
                      .filter(Boolean)
                      .join(" · ") ||
                      event.landing_ref ||
                      "Sin UTM/ref"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export async function LeadDiagnosticsSection({ leadId }: { leadId: string }) {
  const diagnostics = await listLeadDiagnostics(leadId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Diagnósticos personalizados</CardTitle>
      </CardHeader>
      <CardContent>
        {diagnostics.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay un diagnóstico completado.</p>
        ) : (
          <div className="space-y-4">
            {diagnostics.map((diagnostic) => (
              <div key={diagnostic.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{diagnostic.company || diagnostic.email}</p>
                  <Badge variant={diagnostic.report_opened_at ? "success" : "neutral"}>
                    {diagnostic.report_opened_at
                      ? "Informe abierto"
                      : diagnostic.report_sent_at
                        ? "Informe enviado"
                        : "Completado"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {diagnostic.metrics.monthlyHours ?? "—"} h/mes ·{" "}
                  {diagnostic.metrics.yearlyHours ?? "—"} h/año · {diagnostic.metrics.risk ?? "—"}
                </p>
                {diagnostic.metrics.primaryOpportunity ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {diagnostic.metrics.primaryOpportunity}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export async function LeadAttachmentsSection({
  leadId,
  canEdit,
}: {
  leadId: string;
  canEdit: boolean;
}) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("attachments")
    .select("id, name, mime_type, size_bytes, created_at, source, drive_file_id, web_view_link")
    .eq("lead_id", leadId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (
    <AttachmentSection
      entityType="lead"
      entityId={leadId}
      attachments={(data ?? []) as AttachmentItem[]}
      canEdit={canEdit}
    />
  );
}

export async function LeadQuickActionsSection({
  lead,
  senderName,
  canEdit,
  openCallInitially,
  aiEnabled,
  scheduleMembers,
}: {
  lead: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    assigned_to: string | null;
  };
  senderName: string;
  canEdit: boolean;
  openCallInitially: boolean;
  aiEnabled: boolean;
  scheduleMembers: MemberOption[];
}) {
  const googleEnabled = isGoogleEnabled();
  const supabase = await createServerClient();
  const [projectsResult, membersResult] = await Promise.all([
    googleEnabled
      ? supabase
          .from("projects")
          .select("id, name")
          .is("deleted_at", null)
          .in("status", ["planned", "active", "on_hold"])
          .order("name")
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }>, error: null }),
    googleEnabled
      ? supabase.from("team_members").select("id, name, email").is("deleted_at", null).order("name")
      : Promise.resolve({
          data: [] as Array<{ id: string; name: string; email: string }>,
          error: null,
        }),
  ]);

  if (projectsResult.error) throw new Error(projectsResult.error.message);
  if (membersResult.error) throw new Error(membersResult.error.message);

  return (
    <Card className="lg:sticky lg:top-6">
      <CardHeader>
        <CardTitle>Acciones rápidas</CardTitle>
      </CardHeader>
      <CardContent>
        <LeadQuickActions
          leadId={lead.id}
          leadName={lead.name}
          leadEmail={lead.email}
          leadPhone={lead.phone}
          senderName={senderName}
          openCallInitially={openCallInitially}
          claimable={canEdit && !lead.assigned_to}
          aiEnabled={aiEnabled}
          googleEnabled={googleEnabled}
          projects={projectsResult.data ?? []}
          meetMembers={(membersResult.data ?? []).map((member) => ({
            id: member.id,
            name: member.name,
            email: member.email ?? "",
          }))}
          scheduleMembers={scheduleMembers}
          createTaskAction={createTask}
        />
      </CardContent>
    </Card>
  );
}
