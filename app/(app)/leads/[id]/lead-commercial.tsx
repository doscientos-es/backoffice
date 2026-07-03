import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type {
  LeadRelatedInvoice,
  LeadRelatedProject,
  LeadRelatedProposal,
} from "@/lib/leads/types";
import {
  INVOICE_STATUS,
  type InvoiceStatus,
  PROJECT_STATUS,
  PROPOSAL_STATUS,
  type ProjectStatus,
  type ProposalStatus,
} from "@/lib/status";
import { formatEUR } from "@/lib/utils";
import Link from "next/link";

type LeadCommercialProps = {
  leadId: string;
  linkedClientId: string | null;
  proposals: LeadRelatedProposal[];
  projects: LeadRelatedProject[];
  invoices: LeadRelatedInvoice[];
};

/** Shown in place of a list when projects/invoices require a client. */
function ClientRequiredHint() {
  return (
    <p className="px-6 py-2 text-sm text-muted-foreground">
      Disponible cuando el lead sea cliente.
    </p>
  );
}

function EmptyHint({ label }: { label: string }) {
  return <p className="px-6 py-2 text-sm text-muted-foreground">{label}</p>;
}

/**
 * Commercial pipeline shortcuts for a lead: proposals (lead-first, no NIF
 * required), plus projects and invoices that only exist once the lead is
 * converted into a client.
 */
export function LeadCommercial({
  leadId,
  linkedClientId,
  proposals,
  projects,
  invoices,
}: LeadCommercialProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Proposals — always available via the lead-first flow. */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Propuestas</CardTitle>
          <Button asChild size="sm">
            <Link href={`/proposals/new?lead_id=${leadId}`}>Nueva</Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          {proposals.length === 0 ? (
            <EmptyHint label="Sin propuestas." />
          ) : (
            <ul className="divide-y divide-border">
              {proposals.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm"
                >
                  <Link
                    href={`/proposals/${p.id}`}
                    className="truncate font-medium hover:underline"
                  >
                    {p.number ?? p.title ?? "Propuesta"}
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge meta={PROPOSAL_STATUS} value={p.status as ProposalStatus} />
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {formatEUR(Number(p.total ?? 0))}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Projects — require a linked client. */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Proyectos</CardTitle>
          {linkedClientId ? (
            <Button asChild size="sm">
              <Link href={`/projects/new?client_id=${linkedClientId}`}>Nuevo</Link>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="px-0">
          {!linkedClientId ? (
            <ClientRequiredHint />
          ) : projects.length === 0 ? (
            <EmptyHint label="Sin proyectos." />
          ) : (
            <ul className="divide-y divide-border">
              {projects.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm"
                >
                  <Link href={`/projects/${p.id}`} className="truncate font-medium hover:underline">
                    {p.name}
                  </Link>
                  <StatusBadge meta={PROJECT_STATUS} value={p.status as ProjectStatus} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Invoices — require a linked client. */}
      <Card>
        <CardHeader>
          <CardTitle>Facturas</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {!linkedClientId ? (
            <ClientRequiredHint />
          ) : invoices.length === 0 ? (
            <EmptyHint label="Sin facturas." />
          ) : (
            <ul className="divide-y divide-border">
              {invoices.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm"
                >
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="truncate font-medium hover:underline"
                  >
                    {inv.full_number ?? "Factura"}
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge meta={INVOICE_STATUS} value={inv.status as InvoiceStatus} />
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {formatEUR(Number(inv.total ?? 0))}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
