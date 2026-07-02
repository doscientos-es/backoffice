import { BackLink } from "@/components/layout/back-link";
import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { PortalAccessControls } from "@/components/portal/portal-access-controls";
import { AttachmentSection } from "@/components/ui/attachment-section";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionBoundary } from "@/components/ui/error-boundary";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth";
import { isAIEnabled } from "@/lib/env";
import { parseKeyPoints, toEditableKeyPoints } from "@/lib/proposals/key-points";
import { PROPOSAL_STATUS, type ProposalStatus } from "@/lib/status";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";
import { CheckCircle2, Clock, FileText, Presentation, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateProposalPortalAccess } from "../actions";
import { DeleteProposalButton } from "./delete-proposal-button";
import { DuplicateProposalButton } from "./duplicate-proposal-button";
import { GenerateInvoiceButton } from "./generate-invoice-button";
import { MarkAcceptedButton } from "./mark-accepted-button";
import { type EditableItem, ProposalEditor } from "./proposal-editor";
import { type ProposalSpec, ProposalSpecs } from "./proposal-specs";
import { SendPreviewButton } from "./send-preview-button";
import { ShareLinks } from "./share-links";

type Surface = "portal" | "deck";

export const dynamic = "force-dynamic";

export default async function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const supabase = await createServerClient();

  const { data: proposal } = await supabase
    .from("proposals")
    .select("*, clients(id, name), leads(id, name, company), projects(id, name)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!proposal) notFound();

  const { data: items } = await supabase
    .from("proposal_items")
    .select("id, position, description, quantity, unit_price, vat_rate, subtotal")
    .eq("proposal_id", id)
    .order("position");

  // Page-level opens (one row per visit). Slide-level rows are excluded.
  const { data: views } = await supabase
    .from("proposal_view_events")
    .select("id, viewer_type, viewed_at, surface, team_members(name)")
    .eq("proposal_id", id)
    .is("session_id", null)
    .order("viewed_at", { ascending: false })
    .limit(10);

  // Latest CLIENT open per surface — drives the check + date on each share row.
  // Team previews never set this; they show up in the history list below.
  const [{ data: lastPortalView }, { data: lastDeckView }] = await Promise.all([
    supabase
      .from("proposal_view_events")
      .select("viewed_at")
      .eq("proposal_id", id)
      .eq("viewer_type", "client")
      .eq("surface", "portal")
      .is("session_id", null)
      .order("viewed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("proposal_view_events")
      .select("viewed_at")
      .eq("proposal_id", id)
      .eq("viewer_type", "client")
      .eq("surface", "deck")
      .is("session_id", null)
      .order("viewed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const { data: specs } = await supabase
    .from("proposal_specs")
    .select("id, title, body_markdown, is_client_visible, portal_token, updated_at")
    .eq("proposal_id", id)
    .order("created_at", { ascending: true });

  const { data: attachments } = await supabase
    .from("attachments")
    .select("id, name, mime_type, size_bytes, created_at")
    .eq("proposal_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Deposit payments made from the proposal portal
  const { data: depositPayments } = await supabase
    .from("invoice_payments")
    .select("id, amount, status, confirmed_at, created_at, invoice_id")
    .eq("proposal_id", id)
    .order("created_at", { ascending: false });

  const { data: clientFull } = await supabase
    .from("proposals")
    .select("clients(email)")
    .eq("id", id)
    .maybeSingle();

  const client = (proposal as unknown as { clients: { id: string; name: string } | null }).clients;
  const lead = (
    proposal as unknown as { leads: { id: string; name: string; company: string | null } | null }
  ).leads;
  const project = (proposal as unknown as { projects: { id: string; name: string } | null })
    .projects;
  const clientEmail =
    (clientFull as unknown as { clients: { email: string | null } | null } | null)?.clients
      ?.email ?? null;

  const status = proposal.status as ProposalStatus;
  const locked = status === "accepted" || status === "rejected";
  // Drafts authored against a lead never receive a series number until the
  // first transition to `sent` (see `sendPreviewLink`). The header falls back
  // to a human label so the page never renders `null` in the title.
  const proposalNumber = (proposal.number as string | null) ?? "Borrador";
  const recipientName = client?.name ?? lead?.name ?? "Sin destinatario";

  const editableItems: EditableItem[] = ((items ?? []) as unknown as EditableItem[]).map((it) => ({
    id: it.id,
    description: it.description,
    quantity: Number(it.quantity) || 0,
    unit_price: Number(it.unit_price) || 0,
    vat_rate: Number(it.vat_rate) || 0,
  }));

  const viewRows = (views ?? []) as unknown as Array<{
    id: string;
    viewer_type: "team" | "client";
    viewed_at: string;
    surface: Surface;
    team_members: { name: string } | null;
  }>;

  const token = proposal.portal_token as string | null;
  const portalViewedAt = (lastPortalView?.viewed_at as string | null) ?? null;
  const deckViewedAt = (lastDeckView?.viewed_at as string | null) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${proposalNumber} — ${proposal.title as string}`}
        description={recipientName}
        back={<BackLink href="/proposals" label="Volver a propuestas" />}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge meta={PROPOSAL_STATUS} value={status} />
            <DuplicateProposalButton proposalId={id} />
            {status === "accepted" ? (
              <GenerateInvoiceButton proposalId={id} />
            ) : status !== "rejected" ? (
              <MarkAcceptedButton proposalId={id} />
            ) : null}
            <DeleteProposalButton proposalId={id} />
          </div>
        }
      />

      <SectionBoundary label="No se pudo cargar el editor de la propuesta">
        <ProposalEditor
          id={id}
          initialTitle={proposal.title as string}
          initialValidUntil={(proposal.valid_until as string | null) ?? null}
          initialNotes={(proposal.notes as string | null) ?? null}
          initialContextMarkdown={(proposal.context_markdown as string | null) ?? null}
          initialProblems={toEditableKeyPoints(parseKeyPoints(proposal.problems))}
          initialSolutions={toEditableKeyPoints(parseKeyPoints(proposal.solutions))}
          initialTerms={(proposal.terms as string | null) ?? null}
          initialItems={editableItems}
          aiEnabled={isAIEnabled()}
          locked={locked}
        />
      </SectionBoundary>

      <SectionBoundary label="No se pudo cargar la documentación técnica">
        <Card>
          <CardHeader>
            <CardTitle>Documentación técnica</CardTitle>
          </CardHeader>
          <CardContent>
            <ProposalSpecs
              proposalId={id}
              specs={((specs ?? []) as unknown as ProposalSpec[]).map((s) => ({
                id: s.id,
                title: s.title,
                body_markdown: s.body_markdown,
                is_client_visible: s.is_client_visible,
                portal_token: s.portal_token,
                updated_at: s.updated_at,
              }))}
              aiEnabled={isAIEnabled()}
              locked={locked}
            />
          </CardContent>
        </Card>
      </SectionBoundary>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Compartir con el cliente</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {token ? (
              <>
                <ShareLinks
                  token={token}
                  portalViewedAt={portalViewedAt}
                  deckViewedAt={deckViewedAt}
                />
                <PortalAccessControls
                  id={id}
                  initialVisible={(proposal.is_client_visible as boolean | null) ?? true}
                  hasPassword={Boolean(proposal.portal_password_hash)}
                  action={updateProposalPortalAccess}
                />
              </>
            ) : null}
            {locked ? (
              <p className="text-xs text-muted-foreground">La propuesta ya ha sido respondida.</p>
            ) : (
              <SendPreviewButton
                id={id}
                defaultEmail={clientEmail}
                alreadySent={Boolean(proposal.sent_at)}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Información</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailGrid>
              <DetailRow label="Estado">
                <StatusBadge meta={PROPOSAL_STATUS} value={status} />
              </DetailRow>
              <DetailRow label={client ? "Cliente" : "Lead"}>
                {client ? (
                  <Link href={`/clients/${client.id}`} className="hover:underline">
                    {client.name}
                  </Link>
                ) : lead ? (
                  <Link href={`/leads/${lead.id}`} className="hover:underline">
                    {lead.company ? `${lead.name} · ${lead.company}` : lead.name}
                  </Link>
                ) : (
                  "—"
                )}
              </DetailRow>
              {project ? (
                <DetailRow label="Proyecto">
                  <Link href={`/projects/${project.id}`} className="hover:underline">
                    {project.name}
                  </Link>
                </DetailRow>
              ) : null}
              <DetailRow label="Enviada">{formatDate(proposal.sent_at as string | null)}</DetailRow>
              <DetailRow label="Vista">{formatDate(proposal.viewed_at as string | null)}</DetailRow>
              <DetailRow label="Respondida">
                {formatDate(proposal.responded_at as string | null)}
              </DetailRow>
            </DetailGrid>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aperturas recientes</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {viewRows.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">Aún no se ha abierto.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {viewRows.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 px-6 py-2.5">
                  <div className="flex items-center gap-2">
                    <Badge variant={v.viewer_type === "client" ? "info" : "neutral"}>
                      {v.viewer_type === "client" ? "Cliente" : "Equipo"}
                    </Badge>
                    <Badge variant="outline">
                      {v.surface === "deck" ? (
                        <>
                          <Presentation aria-hidden /> Presentación
                        </>
                      ) : (
                        <>
                          <FileText aria-hidden /> Propuesta
                        </>
                      )}
                    </Badge>
                    <span className="text-muted-foreground">
                      {v.viewer_type === "team"
                        ? (v.team_members?.name ?? "Miembro")
                        : "Apertura externa"}
                    </span>
                  </div>
                  <time
                    dateTime={v.viewed_at}
                    className="text-xs text-muted-foreground tabular-nums"
                  >
                    {new Date(v.viewed_at).toLocaleString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {depositPayments && depositPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Señal / Pagos de reserva</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y divide-border text-sm">
              {depositPayments.map((p) => {
                const pStatus = p.status as string;
                const icon =
                  pStatus === "confirmed" ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : pStatus === "failed" ? (
                    <XCircle className="size-4 text-red-500" />
                  ) : (
                    <Clock className="size-4 text-amber-500" />
                  );
                return (
                  <li
                    key={p.id as string}
                    className="flex items-center justify-between gap-3 px-6 py-3"
                  >
                    <div className="flex items-center gap-2">
                      {icon}
                      <span className="font-medium tabular-nums">
                        {formatEUR(Number(p.amount))}
                      </span>
                      <Badge
                        variant={
                          pStatus === "confirmed"
                            ? "success"
                            : pStatus === "failed"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {pStatus === "confirmed"
                          ? "Confirmado"
                          : pStatus === "failed"
                            ? "Fallido"
                            : "Pendiente"}
                      </Badge>
                      {p.confirmed_at && (
                        <span className="text-xs text-muted-foreground">
                          {formatDate(p.confirmed_at as string)}
                        </span>
                      )}
                    </div>
                    {p.invoice_id && (
                      <Link
                        href={`/invoices/${p.invoice_id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        Ver factura →
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <AttachmentSection
        entityType="proposal"
        entityId={id}
        attachments={
          (attachments ?? []) as import("@/components/ui/attachment-section").AttachmentItem[]
        }
        canEdit={!locked}
      />
    </div>
  );
}
