import { LogoMark } from "@/components/branding";
import { Markdown } from "@/components/ui/markdown";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth";
import { scopedLogger } from "@/lib/logger";
import { PROPOSAL_STATUS, type ProposalStatus } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatEUR } from "@/lib/utils";
import { FileText } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ProposalActions } from "./proposal-actions";

const log = scopedLogger("portal.proposal");

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Propuesta · doscientos",
  robots: { index: false, follow: false },
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

  const { data: specs } = await admin
    .from("proposal_specs")
    .select("id, title, portal_token")
    .eq("proposal_id", proposal.id as string)
    .eq("is_client_visible", true)
    .not("portal_token", "is", null);

  // Detect whether the current visitor is a logged-in team member so we can
  // tag the view appropriately and avoid bumping the proposal to 'viewed'
  // when we are previewing it ourselves.
  const auth = await getCurrentUser();
  const isTeam = auth.ok;

  // Bump status from 'sent' to 'viewed' only on the first external (client)
  // view. Team previews never transition the status.
  if (!isTeam && proposal.status === "sent") {
    await admin
      .from("proposals")
      .update({ status: "viewed", viewed_at: new Date().toISOString() })
      .eq("id", proposal.id as string)
      .eq("status", "sent");
  }

  // Best-effort view tracking. Never throws to the visitor.
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0]?.trim() : (h.get("x-real-ip") ?? null);
    const userAgent = h.get("user-agent");
    await admin.from("proposal_view_events").insert({
      proposal_id: proposal.id as string,
      viewer_type: isTeam ? "team" : "client",
      team_member_id: isTeam ? auth.user.id : null,
      surface: "portal",
      ip,
      user_agent: userAgent,
    });
  } catch (err) {
    log.warn({ err, proposalId: proposal.id }, "proposal_view_insert_failed");
  }

  const client = (proposal as unknown as { clients: { name: string } | null }).clients;
  const status = proposal.status as ProposalStatus;
  const responded = status === "accepted" || status === "rejected";
  const safeItems = (items ?? []) as unknown as ProposalItem[];
  const safeSpecs = (specs ?? []) as unknown as Array<{
    id: string;
    title: string;
    portal_token: string;
  }>;
  const intro = (proposal.intro as string | null) ?? null;
  const terms = (proposal.terms as string | null) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <article className="rounded-xl bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 overflow-hidden">
        {/* Document header */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 px-8 py-7 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1">
              <LogoMark size={20} className="text-[#2A4227] dark:text-[#9CC196]" />
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                doscientos
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              Presupuesto · {proposal.number as string}
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-1.5">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {proposal.title as string}
              </h1>
              <StatusBadge meta={PROPOSAL_STATUS} value={status} />
            </div>
            {proposal.valid_until ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Válida hasta:{" "}
                <strong className="text-zinc-700 dark:text-zinc-300">
                  {formatDate(proposal.valid_until as string)}
                </strong>
              </p>
            ) : null}
          </div>
        </div>

        {/* Recipient */}
        <div className="px-8 py-5 border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/50">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600 mb-1">
            Dirigido a
          </p>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {client?.name ?? "—"}
          </p>
        </div>

        {/* Intro (markdown) */}
        {intro ? (
          <div className="border-b border-zinc-100 dark:border-zinc-800/60 px-8 py-6">
            <Markdown source={intro} />
          </div>
        ) : null}

        {/* Line items */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-8 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                  Descripción
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                  Cant.
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                  Precio
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                  IVA
                </th>
                <th className="px-8 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody>
              {safeItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-6 text-sm text-zinc-400 dark:text-zinc-600">
                    Sin líneas.
                  </td>
                </tr>
              ) : (
                safeItems.map((item, i) => (
                  <tr
                    key={item.id}
                    className={i > 0 ? "border-t border-zinc-100 dark:border-zinc-800/60" : ""}
                  >
                    <td className="px-8 py-3.5 text-zinc-800 dark:text-zinc-200">
                      {item.description}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                      {formatEUR(item.unit_price)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                      {item.vat_rate}%
                    </td>
                    <td className="px-8 py-3.5 text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                      {formatEUR(item.subtotal)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-8 py-5 flex justify-end">
          <div className="flex flex-col gap-1.5 w-56">
            <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatEUR(proposal.subtotal as number)}</span>
            </div>
            <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>IVA</span>
              <span className="tabular-nums">{formatEUR(proposal.tax_amount as number)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-zinc-900 dark:text-zinc-100 border-t border-zinc-200 dark:border-zinc-700 pt-2 mt-1">
              <span>Total</span>
              <span className="tabular-nums">{formatEUR(proposal.total as number)}</span>
            </div>
          </div>
        </div>

        {/* Terms (markdown) */}
        {terms ? (
          <div className="border-t border-zinc-100 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/50 px-8 py-6">
            <Markdown source={terms} />
          </div>
        ) : null}

        {/* Notes */}
        {(proposal.notes as string | null) ? (
          <div className="border-t border-zinc-100 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/50 px-8 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600 mb-2">
              Notas
            </p>
            <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {proposal.notes as string}
            </p>
          </div>
        ) : null}

        {/* Technical specs */}
        {safeSpecs.length > 0 ? (
          <div className="border-t border-zinc-200 dark:border-zinc-800 px-8 py-6">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600 mb-3">
              Documentación técnica
            </p>
            <ul className="flex flex-col gap-2">
              {safeSpecs.map((spec) => (
                <li key={spec.id}>
                  <a
                    href={`/p/spec/${spec.portal_token}`}
                    className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 hover:border-[#2A4227] hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <FileText className="size-4 text-zinc-400 dark:text-zinc-600 shrink-0" />
                    <span className="flex-1 truncate font-medium">{spec.title}</span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-600">Abrir →</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </article>

      {/* Response area */}
      {responded ? (
        <p className="text-center text-xs text-zinc-400 dark:text-zinc-600 py-2">
          Respondida el {formatDate(proposal.responded_at as string | null)}.
        </p>
      ) : (
        <ProposalActions token={token} />
      )}
    </div>
  );
}
