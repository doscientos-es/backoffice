import { BackLink } from "@/components/layout/back-link";
import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth";
import { isAIEnabled } from "@/lib/env";
import { PROPOSAL_STATUS, type ProposalStatus } from "@/lib/status";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { Check, FileText, Presentation } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GenerateInvoiceButton } from "./generate-invoice-button";
import { type EditableItem, ProposalEditor } from "./proposal-editor";
import { type ProposalSpec, ProposalSpecs } from "./proposal-specs";
import { SendPreviewButton } from "./send-preview-button";

type Surface = "portal" | "deck";

function formatViewedAt(value: string): string {
  return new Date(value).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ShareLinkRow({
  href,
  icon,
  label,
  description,
  lastViewedAt,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  lastViewedAt: string | null;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3 transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:bg-background">
          {icon}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium">{label}</span>
          <span className="truncate text-[11px] text-muted-foreground">{description}</span>
        </div>
      </div>
      {lastViewedAt ? (
        <div className="flex shrink-0 items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
          <Check className="size-3.5" aria-hidden />
          <time dateTime={lastViewedAt} className="text-[11px] tabular-nums">
            Vista el {formatViewedAt(lastViewedAt)}
          </time>
        </div>
      ) : (
        <span className="shrink-0 text-[11px] text-muted-foreground">Sin abrir</span>
      )}
    </Link>
  );
}

export const dynamic = "force-dynamic";

export default async function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const supabase = await createServerClient();

  const { data: proposal } = await supabase
    .from("proposals")
    .select("*, clients(id, name), projects(id, name)")
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

  const { data: clientFull } = await supabase
    .from("proposals")
    .select("clients(email)")
    .eq("id", id)
    .maybeSingle();

  const client = (proposal as unknown as { clients: { id: string; name: string } | null }).clients;
  const project = (proposal as unknown as { projects: { id: string; name: string } | null })
    .projects;
  const clientEmail =
    (clientFull as unknown as { clients: { email: string | null } | null } | null)?.clients
      ?.email ?? null;

  const status = proposal.status as ProposalStatus;
  const locked = status === "accepted" || status === "rejected";

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
        title={`${proposal.number as string} — ${proposal.title as string}`}
        description={client?.name}
        back={<BackLink href="/proposals" label="Volver a propuestas" />}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge meta={PROPOSAL_STATUS} value={status} />
            {status === "accepted" ? <GenerateInvoiceButton proposalId={id} /> : null}
          </div>
        }
      />

      <ProposalEditor
        id={id}
        initialTitle={proposal.title as string}
        initialValidUntil={(proposal.valid_until as string | null) ?? null}
        initialNotes={(proposal.notes as string | null) ?? null}
        initialIntro={(proposal.intro as string | null) ?? null}
        initialTerms={(proposal.terms as string | null) ?? null}
        initialItems={editableItems}
        locked={locked}
      />

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

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Compartir con el cliente</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {token ? (
              <div className="flex flex-col gap-2">
                <ShareLinkRow
                  href={`/p/proposal/${token}`}
                  icon={<FileText className="size-4" aria-hidden />}
                  label="Propuesta"
                  description={`/p/proposal/${token}`}
                  lastViewedAt={portalViewedAt}
                />
                <ShareLinkRow
                  href={`/deck/${token}`}
                  icon={<Presentation className="size-4" aria-hidden />}
                  label="Presentación"
                  description={`/deck/${token}`}
                  lastViewedAt={deckViewedAt}
                />
              </div>
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
              <DetailRow label="Cliente">
                {client ? (
                  <Link href={`/clients/${client.id}`} className="hover:underline">
                    {client.name}
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
    </div>
  );
}
