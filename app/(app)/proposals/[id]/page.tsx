import { BackLink } from "@/components/layout/back-link";
import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const STATUS_VARIANT = {
  draft: "neutral",
  sent: "info",
  viewed: "warning",
  accepted: "success",
  rejected: "danger",
  expired: "danger",
} as const;

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviada",
  viewed: "Vista",
  accepted: "Aceptada",
  rejected: "Rechazada",
  expired: "Expirada",
};

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

  const client = (proposal as unknown as { clients: { id: string; name: string } | null }).clients;
  const project = (proposal as unknown as { projects: { id: string; name: string } | null })
    .projects;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${proposal.number as string} — ${proposal.title as string}`}
        description={client?.name}
        back={<BackLink href="/proposals" label="Volver a propuestas" />}
        actions={
          <Badge variant={STATUS_VARIANT[proposal.status as keyof typeof STATUS_VARIANT]}>
            {STATUS_LABEL[proposal.status as string] ?? (proposal.status as string)}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle>Líneas</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {!items || items.length === 0 ? (
              <p className="px-6 py-4 text-sm text-muted-foreground">Sin líneas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-2 font-medium">Descripción</th>
                      <th className="px-5 py-2 font-medium text-right">Cant.</th>
                      <th className="px-5 py-2 font-medium text-right">Precio</th>
                      <th className="px-5 py-2 font-medium text-right">IVA %</th>
                      <th className="px-5 py-2 font-medium text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id as string} className="border-t border-border">
                        <td className="px-5 py-2.5">{item.description as string}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums">
                          {item.quantity as number}
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums">
                          {formatEUR(item.unit_price as number)}
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums">
                          {item.vat_rate as number}%
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums font-medium">
                          {formatEUR(item.subtotal as number)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-border">
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-2.5 text-right text-xs text-muted-foreground"
                      >
                        Subtotal
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        {formatEUR(proposal.subtotal as number)}
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-2.5 text-right text-xs text-muted-foreground"
                      >
                        IVA
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        {formatEUR(proposal.tax_amount as number)}
                      </td>
                    </tr>
                    <tr className="font-semibold">
                      <td colSpan={4} className="px-5 py-2.5 text-right">
                        Total
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        {formatEUR(proposal.total as number)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Información</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailGrid>
              <DetailRow label="Estado">
                <Badge variant={STATUS_VARIANT[proposal.status as keyof typeof STATUS_VARIANT]}>
                  {STATUS_LABEL[proposal.status as string] ?? (proposal.status as string)}
                </Badge>
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
              <DetailRow label="Válida hasta">
                {formatDate(proposal.valid_until as string | null)}
              </DetailRow>
              <DetailRow label="Enviada">{formatDate(proposal.sent_at as string | null)}</DetailRow>
              <DetailRow label="Vista">{formatDate(proposal.viewed_at as string | null)}</DetailRow>
              <DetailRow label="Respondida">
                {formatDate(proposal.responded_at as string | null)}
              </DetailRow>
            </DetailGrid>

            {(proposal.portal_token as string | null) && proposal.status !== "draft" ? (
              <div className="mt-4 border-t border-border pt-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
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

            {(proposal.notes as string | null) ? (
              <div className="mt-4 border-t border-border pt-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Notas
                </p>
                <p className="whitespace-pre-wrap text-sm">{proposal.notes as string}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
