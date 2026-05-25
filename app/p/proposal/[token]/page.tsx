import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatEUR } from "@/lib/utils";
import { notFound } from "next/navigation";
import { ProposalActions } from "./proposal-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Propuesta · doscientos", robots: { index: false, follow: false } };

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
  sent: "Pendiente",
  viewed: "Vista",
  accepted: "Aceptada",
  rejected: "Rechazada",
  expired: "Expirada",
};

type ProposalItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  subtotal: number;
};

export default async function PortalProposalPage({
  params,
}: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: proposal } = await admin
    .from("proposals")
    .select("*, clients(name)")
    .eq("portal_token", token)
    .is("deleted_at", null)
    .maybeSingle();

  if (!proposal || proposal.status === "draft") notFound();

  const { data: items } = await admin
    .from("proposal_items")
    .select("id, position, description, quantity, unit_price, vat_rate, subtotal")
    .eq("proposal_id", proposal.id as string)
    .order("position");

  // First-view tracking: bump status from 'sent' to 'viewed' once.
  if (proposal.status === "sent") {
    await admin
      .from("proposals")
      .update({ status: "viewed", viewed_at: new Date().toISOString() })
      .eq("id", proposal.id as string)
      .eq("status", "sent");
  }

  const client = (proposal as unknown as { clients: { name: string } | null }).clients;
  const status = proposal.status as keyof typeof STATUS_VARIANT;
  const responded = status === "accepted" || status === "rejected";
  const safeItems = (items ?? []) as unknown as ProposalItem[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--text-primary)]">
            {proposal.title as string}
          </h1>
          <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status] ?? status}</Badge>
        </div>
        <p className="text-sm text-[color:var(--text-muted)]">
          {proposal.number as string} · {client?.name ?? "—"}
          {proposal.valid_until ? ` · Válida hasta ${formatDate(proposal.valid_until as string)}` : ""}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Detalle</CardTitle></CardHeader>
        <CardContent className="px-0">
          {safeItems.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">Sin líneas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-2 font-medium">Descripción</th>
                    <th className="px-5 py-2 font-medium text-right">Cant.</th>
                    <th className="px-5 py-2 font-medium text-right">Precio</th>
                    <th className="px-5 py-2 font-medium text-right">IVA</th>
                    <th className="px-5 py-2 font-medium text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {safeItems.map((item) => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="px-5 py-2.5">{item.description}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{item.quantity}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{formatEUR(item.unit_price)}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{item.vat_rate}%</td>
                      <td className="px-5 py-2.5 text-right tabular-nums font-medium">
                        {formatEUR(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border">
                  <tr>
                    <td colSpan={4} className="px-5 py-2.5 text-right text-xs text-muted-foreground">Subtotal</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{formatEUR(proposal.subtotal as number)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-5 py-2.5 text-right text-xs text-muted-foreground">IVA</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{formatEUR(proposal.tax_amount as number)}</td>
                  </tr>
                  <tr className="font-semibold">
                    <td colSpan={4} className="px-5 py-2.5 text-right">Total</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{formatEUR(proposal.total as number)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {(proposal.notes as string | null) ? (
        <Card>
          <CardHeader><CardTitle>Notas</CardTitle></CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{proposal.notes as string}</p>
          </CardContent>
        </Card>
      ) : null}

      {responded ? (
        <p className="text-center text-sm text-[color:var(--text-muted)]">
          Respondida el {formatDate(proposal.responded_at as string | null)}.
        </p>
      ) : (
        <ProposalActions token={token} />
      )}
    </div>
  );
}
