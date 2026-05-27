import { BackLink } from "@/components/layout/back-link";
import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth";
import { isAIEnabled } from "@/lib/env";
import { PROPOSAL_STATUS, type ProposalStatus } from "@/lib/status";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GenerateInvoiceButton } from "./generate-invoice-button";
import { ProposalEditor, type EditableItem } from "./proposal-editor";
import { ProposalSpecs, type ProposalSpec } from "./proposal-specs";
import { SendPreviewButton } from "./send-preview-button";

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

  const { data: views } = await supabase
    .from("proposal_views")
    .select("id, viewer_type, viewed_at, team_members(name)")
    .eq("proposal_id", id)
    .order("viewed_at", { ascending: false })
    .limit(10);

  const { data: specs } = await supabase
    .from("documents")
    .select("id, title, body_markdown, is_client_visible, portal_token, updated_at")
    .eq("proposal_id", id)
    .eq("kind", "technical_spec")
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
    description: it.description,
    quantity: Number(it.quantity) || 0,
    unit_price: Number(it.unit_price) || 0,
    vat_rate: Number(it.vat_rate) || 0,
  }));

  const viewRows = (views ?? []) as unknown as Array<{
    id: string;
    viewer_type: "team" | "client";
    viewed_at: string;
    team_members: { name: string } | null;
  }>;

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
            {(proposal.portal_token as string | null) ? (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Enlace portal
                </p>
                <a
                  href={`/p/proposal/${proposal.portal_token as string}`}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-xs text-primary hover:underline"
                >
                  /p/proposal/{proposal.portal_token as string}
                </a>
              </div>
            ) : null}
            {locked ? (
              <p className="text-xs text-muted-foreground">
                La propuesta ya ha sido respondida.
              </p>
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
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-3 px-6 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={v.viewer_type === "client" ? "info" : "neutral"}>
                      {v.viewer_type === "client" ? "Cliente" : "Equipo"}
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
