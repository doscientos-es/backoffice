import { LogoMark } from "@/components/branding";
import { PortalPasswordGate } from "@/components/portal/password-gate";
import { ProposalPaymentButton } from "@/components/portal/proposal-payment-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Markdown } from "@/components/ui/markdown";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth";
import { BILLING_CYCLE_LABELS, type BillingCycle, computeProposalTotals } from "@/lib/finance";
import { scopedLogger } from "@/lib/logger";
import { isPortalUnlocked } from "@/lib/portal/access";
import { parseKeyPoints } from "@/lib/proposals/key-points";
import { PROPOSAL_STATUS, type ProposalStatus } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatEUR } from "@/lib/utils";
import { CheckCircle2, FileText, Presentation, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { unlockProposalPortal } from "./actions";
import { PortalKeyPointsList, PortalNarrativeBlock } from "./narrative";
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
  billing_cycle: BillingCycle | null;
};

export default async function PortalProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { token } = await params;
  const { success, error } = await searchParams;
  const admin = createAdminClient();

  // Resolve auth first so team members can preview drafts.
  const auth = await getCurrentUser();
  const isTeam = auth.ok;

  const { data: proposal } = await admin
    .from("proposals")
    .select(
      "*, clients(name, nif, billing_address, email, phone, contact_person, logo_url), leads(name, email, phone, company)",
    )
    .eq("portal_token", token)
    .is("deleted_at", null)
    .maybeSingle();

  // Drafts are only accessible to authenticated team members.
  if (!proposal) {
    log.error({ token }, "portal_proposal_not_found — query returned null");
    notFound();
  }
  if (proposal.status === "draft" && !isTeam) {
    log.warn({ proposalId: proposal.id, status: proposal.status }, "portal_draft_blocked_non_team");
    notFound();
  }

  const isDraft = proposal.status === "draft";

  // Client-facing access gate: hidden proposals 404 and password-protected
  // ones show the unlock form until the visitor presents a valid cookie. Team
  // members always bypass so they can preview the link.
  if (!isTeam) {
    if ((proposal.is_client_visible as boolean | null) === false) {
      log.warn({ proposalId: proposal.id }, "portal_proposal_hidden_from_client");
      notFound();
    }
    const unlocked = await isPortalUnlocked(
      token,
      (proposal.portal_password_hash as string | null) ?? null,
    );
    if (!unlocked) {
      return <PortalPasswordGate token={token} action={unlockProposalPortal} />;
    }
  }

  const { data: items } = await admin
    .from("proposal_items")
    .select("id, position, description, quantity, unit_price, vat_rate, subtotal, billing_cycle")
    .eq("proposal_id", proposal.id as string)
    .order("position");

  const { data: specs } = await admin
    .from("proposal_specs")
    .select("id, title, portal_token")
    .eq("proposal_id", proposal.id as string)
    .eq("is_client_visible", true)
    .not("portal_token", "is", null);

  // Bump status from 'sent' to 'viewed' only on the first external (client)
  // view. Team previews and drafts never transition the status.
  if (!isTeam && !isDraft && proposal.status === "sent") {
    await admin
      .from("proposals")
      .update({ status: "viewed", viewed_at: new Date().toISOString() })
      .eq("id", proposal.id as string)
      .eq("status", "sent");
  }

  // Best-effort view tracking. Skipped for draft previews.
  if (!isDraft) {
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
  }

  const client = (
    proposal as unknown as {
      clients: {
        name: string;
        nif: string | null;
        billing_address: string | null;
        email: string | null;
        phone: string | null;
        contact_person: string | null;
        logo_url: string | null;
      } | null;
    }
  ).clients;
  const lead = (
    proposal as unknown as {
      leads: {
        name: string;
        email: string | null;
        phone: string | null;
        company: string | null;
      } | null;
    }
  ).leads;
  const status = proposal.status as ProposalStatus;
  const responded = status === "accepted" || status === "rejected";

  // The lead branch always asks for fiscal data (no `clients` row exists yet).
  // The client branch only asks when the legal minimum (name + NIF + billing
  // address) is missing — typically a placeholder client created by the
  // back-office for prospects that never went through onboarding.
  const needsFiscal =
    !client || !client.nif?.trim() || !client.billing_address?.trim() || !client.name?.trim();
  const fiscalPrefill = client
    ? {
      name: client.name ?? "",
      nif: client.nif ?? "",
      billing_address: client.billing_address ?? "",
      contact_person: client.contact_person ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
    }
    : {
      name: lead?.company ?? lead?.name ?? "",
      nif: "",
      billing_address: "",
      contact_person: lead?.name ?? "",
      email: lead?.email ?? "",
      phone: lead?.phone ?? "",
    };
  const recipientName = client?.name ?? lead?.company ?? lead?.name ?? "—";
  const proposalNumber = (proposal.number as string | null) ?? "Borrador";
  const safeItems = (items ?? []) as unknown as ProposalItem[];
  const safeSpecs = (specs ?? []) as unknown as Array<{
    id: string;
    title: string;
    portal_token: string;
  }>;
  const contextMarkdown = (proposal.context_markdown as string | null) ?? null;
  const problems = parseKeyPoints(proposal.problems);
  const solutions = parseKeyPoints(proposal.solutions);
  const terms = (proposal.terms as string | null) ?? null;

  // Recompute totals on the fly so we can show separate buckets for one-time
  // and recurring lines. The stored `proposals.total` reflects the one-time
  // portion only — kept in sync by the proposal actions.
  const totals = computeProposalTotals(
    safeItems.map((it) => ({
      quantity: it.quantity,
      unit_price: it.unit_price,
      vat_rate: it.vat_rate,
      billing_cycle: it.billing_cycle ?? "none",
    })),
  );
  const hasRecurring =
    totals.monthly.total > 0 || totals.quarterly.total > 0 || totals.yearly.total > 0;

  // Fetch confirmed payments for this proposal (signal/deposit)
  const { data: proposalPayments } = await admin
    .from("invoice_payments")
    .select("id, amount, status, created_at")
    .eq("proposal_id", proposal.id as string)
    .eq("status", "confirmed");

  const confirmedPayments = proposalPayments ?? [];
  const signalPaid = confirmedPayments.length > 0;
  const depositAmount = Math.round(Number(proposal.total) * 50) / 100;

  return (
    <div className="flex flex-col gap-4">
      {isDraft && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
          <span className="uppercase tracking-wider">Borrador</span>
          <span className="opacity-50">·</span>
          <span className="font-normal opacity-75">Vista previa — solo visible para el equipo</span>
        </div>
      )}
      {success && (
        <Alert className="border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <AlertTitle className="text-emerald-800 dark:text-emerald-300">Pago confirmado</AlertTitle>
          <AlertDescription className="text-emerald-700 dark:text-emerald-400">
            Hemos recibido el pago de la señal. El proyecto se pondrá en marcha en breve.
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Error en el pago</AlertTitle>
          <AlertDescription>
            No se ha podido procesar el pago. Por favor, inténtalo de nuevo o contacta con nosotros.
          </AlertDescription>
        </Alert>
      )}
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
              Presupuesto · {proposalNumber}
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
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600 mb-2">
            Dirigido a
          </p>
          <div className="flex items-center gap-3">
            {client?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={client.logo_url}
                alt={`Logo ${recipientName}`}
                className="size-8 rounded object-contain"
              />
            ) : null}
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{recipientName}</p>
          </div>
        </div>

        {/* Narrative: Context → Problems → Solutions (always before price) */}
        {contextMarkdown || problems.length > 0 || solutions.length > 0 ? (
          <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800/60 border-b border-zinc-100 dark:border-zinc-800/60">
            {contextMarkdown ? (
              <PortalNarrativeBlock label="Contexto">
                <Markdown source={contextMarkdown} />
              </PortalNarrativeBlock>
            ) : null}
            {problems.length > 0 ? (
              <PortalNarrativeBlock label="Problemas detectados">
                <PortalKeyPointsList items={problems} variant="problems" />
              </PortalNarrativeBlock>
            ) : null}
            {solutions.length > 0 ? (
              <PortalNarrativeBlock label="Cómo lo abordamos">
                <PortalKeyPointsList items={solutions} variant="solutions" />
              </PortalNarrativeBlock>
            ) : null}
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
                {hasRecurring ? (
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                    Cadencia
                  </th>
                ) : null}
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
                  <td
                    colSpan={hasRecurring ? 6 : 5}
                    className="px-8 py-6 text-sm text-zinc-400 dark:text-zinc-600"
                  >
                    Sin líneas.
                  </td>
                </tr>
              ) : (
                safeItems.map((item, i) => {
                  const cycle: BillingCycle = item.billing_cycle ?? "none";
                  return (
                    <tr
                      key={item.id}
                      className={i > 0 ? "border-t border-zinc-100 dark:border-zinc-800/60" : ""}
                    >
                      <td className="px-8 py-3.5 text-zinc-800 dark:text-zinc-200">
                        {item.description}
                      </td>
                      {hasRecurring ? (
                        <td className="px-4 py-3.5 text-left text-xs">
                          {cycle === "none" ? (
                            <span className="text-zinc-400 dark:text-zinc-600">
                              {BILLING_CYCLE_LABELS.none}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-[#2A4227]/10 dark:bg-[#9CC196]/10 px-2 py-0.5 font-medium text-[#2A4227] dark:text-[#9CC196]">
                              {BILLING_CYCLE_LABELS[cycle]}
                            </span>
                          )}
                        </td>
                      ) : null}
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-8 py-5 flex justify-end">
          <div className="flex flex-col gap-3 w-64">
            <div className="flex flex-col gap-1.5">
              {hasRecurring ? (
                <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                  Inversión inicial
                </p>
              ) : null}
              <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatEUR(totals.oneTime.subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <span>IVA</span>
                <span className="tabular-nums">{formatEUR(totals.oneTime.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-zinc-900 dark:text-zinc-100 border-t border-zinc-200 dark:border-zinc-700 pt-2 mt-1">
                <span>Total</span>
                <span className="tabular-nums">{formatEUR(totals.oneTime.total)}</span>
              </div>
            </div>

            {hasRecurring ? (
              <div className="flex flex-col gap-1.5 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                  Mantenimiento recurrente
                </p>
                {totals.monthly.total > 0 ? (
                  <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                    <span>Mensual</span>
                    <span className="tabular-nums font-medium">
                      {formatEUR(totals.monthly.total)}
                    </span>
                  </div>
                ) : null}
                {totals.quarterly.total > 0 ? (
                  <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                    <span>Trimestral</span>
                    <span className="tabular-nums font-medium">
                      {formatEUR(totals.quarterly.total)}
                    </span>
                  </div>
                ) : null}
                {totals.yearly.total > 0 ? (
                  <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                    <span>Anual</span>
                    <span className="tabular-nums font-medium">
                      {formatEUR(totals.yearly.total)}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
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
            <Markdown
              source={proposal.notes as string}
              className="text-zinc-700 dark:text-zinc-300"
            />
          </div>
        ) : null}

        {/* Deck link + Technical specs */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-8 py-6 flex flex-col gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600 mb-3">
              Presentación
            </p>
            <a
              href={`/deck/${token}`}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 hover:border-[#2A4227] hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <Presentation className="size-4 text-zinc-400 dark:text-zinc-600 shrink-0" />
              <span className="flex-1 truncate font-medium">Ver presentación del proyecto</span>
              <span className="text-xs text-zinc-400 dark:text-zinc-600">Abrir →</span>
            </a>
          </div>

          {safeSpecs.length > 0 ? (
            <div>
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
        </div>
      </article>

      {/* Response area — hidden for draft previews */}
      {!isDraft && responded ? (
        <div className="flex flex-col items-center gap-4 py-4">
          <p className="text-center text-xs text-zinc-400 dark:text-zinc-600">
            Respondida el {formatDate(proposal.responded_at as string | null)}.
          </p>

          {status === "accepted" && !signalPaid && !isTeam && (
            <div className="w-full max-w-md p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col items-center gap-4">
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Reserva tu proyecto
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Para poner en marcha el proyecto, es necesario abonar la señal del 50%.
                </p>
              </div>
              <ProposalPaymentButton
                proposalId={proposal.id as string}
                token={token}
                depositAmount={depositAmount}
              />
            </div>
          )}

          {status === "accepted" && signalPaid && confirmedPayments[0] && (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  Señal de reserva abonada ({formatEUR(confirmedPayments[0].amount)})
                </span>
              </div>
              <a
                href={`/p/proposal/${token}/receipt/${confirmedPayments[0].id}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-[#2A4227] dark:text-[#9CC196] hover:underline flex items-center gap-1.5"
              >
                <FileText className="size-3.5" />
                Ver justificante de pago
              </a>
            </div>
          )}
        </div>
      ) : !isDraft ? (
        <ProposalActions token={token} needsFiscal={needsFiscal} fiscalPrefill={fiscalPrefill} />
      ) : null}
    </div>
  );
}
