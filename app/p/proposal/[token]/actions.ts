"use server";

import {
  ensureClientForProposal,
  ensureProjectForProposal,
  hasCompleteFiscalData,
  promoteLeadFromClient,
} from "@/lib/crm/conversion";
import { scopedLogger } from "@/lib/logger";
import {
  AcceptProposalFiscalData,
  type AcceptProposalFiscalDataType,
  ProposalPortalToken,
  ProposalRejectionReason,
} from "@/lib/schemas/proposal";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

const log = scopedLogger("portal.proposal");

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Atomically transitions a proposal to `accepted`, performing the fiscal-data
 * upgrade and project creation as a single best-effort sequence:
 *
 *   1. Validate the submitted fiscal data when the destination row lacks it.
 *   2. Promote `lead → client` (or patch missing client fields).
 *   3. Snapshot the accepted fiscal data on the proposal for audit.
 *   4. Flip status to `accepted` (`responded_at` set).
 *   5. Auto-generate the project and promote the originating lead to `won`.
 *
 * Steps 1–3 are required: any failure aborts before we flip the status, so
 * an accepted proposal always has a billable client behind it. Steps 4 and
 * 5 are kept as separate writes because PostgREST doesn't give us a single
 * transaction across multiple tables — `ensureClientForProposal` re-points
 * the proposal to the new client_id before we mark it accepted.
 */
async function acceptWithFiscal(token: string, fiscalInput: unknown): Promise<ActionResult> {
  const parsed = ProposalPortalToken.safeParse(token);
  if (!parsed.success) return { ok: false, error: "Token inválido" };

  const admin = createAdminClient();
  const { data: proposal, error: fetchError } = await admin
    .from("proposals")
    .select(
      "id, status, client_id, lead_id, clients(name, nif, billing_address), leads(name, email, phone, company)",
    )
    .eq("portal_token", parsed.data)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError || !proposal) return { ok: false, error: "Propuesta no encontrada" };
  if (proposal.status === "accepted" || proposal.status === "rejected") {
    return { ok: false, error: "Esta propuesta ya ha sido respondida" };
  }
  if (proposal.status === "expired") return { ok: false, error: "Propuesta expirada" };
  if (proposal.status === "draft") return { ok: false, error: "Propuesta no disponible" };

  // Decide whether we need fiscal data: leads always require it, clients
  // only when their row is missing the legal minimum (name + NIF + address).
  const client = (
    proposal as unknown as {
      clients: { name: string | null; nif: string | null; billing_address: string | null } | null;
    }
  ).clients;
  const needsFiscal = proposal.lead_id != null || !client || !hasCompleteFiscalData(client);

  let fiscal: AcceptProposalFiscalDataType | undefined;
  if (needsFiscal) {
    const parsedFiscal = AcceptProposalFiscalData.safeParse(fiscalInput);
    if (!parsedFiscal.success) {
      return {
        ok: false,
        error: parsedFiscal.error.errors[0]?.message ?? "Datos fiscales no válidos",
      };
    }
    fiscal = parsedFiscal.data;

    const ensured = await ensureClientForProposal(admin, proposal.id as string, fiscal);
    if ("error" in ensured) return { ok: false, error: ensured.error };
  }

  const { error: updateError } = await admin
    .from("proposals")
    .update({
      status: "accepted",
      responded_at: new Date().toISOString(),
      accepted_fiscal_data: fiscal ?? null,
    })
    .eq("id", proposal.id);
  if (updateError) return { ok: false, error: "No se pudo actualizar la propuesta" };

  // Best-effort side-effects: project creation + lead promotion. Failures
  // are logged but never reverse the acceptance — the customer's response
  // is the source of truth.
  try {
    const { projectId } = await ensureProjectForProposal(admin, proposal.id as string);

    const { data: full } = await admin
      .from("proposals")
      .select("client_id")
      .eq("id", proposal.id)
      .maybeSingle();
    if (full?.client_id) {
      await promoteLeadFromClient(admin, full.client_id as string);
    }

    log.info({ proposalId: proposal.id, projectId }, "proposal_accepted_side_effects_done");
  } catch (err) {
    log.warn({ err, proposalId: proposal.id }, "proposal_accepted_side_effects_failed");
  }

  revalidatePath(`/p/proposal/${parsed.data}`);
  return { ok: true };
}

async function rejectAction(token: string, rejectionReason?: string): Promise<ActionResult> {
  const parsed = ProposalPortalToken.safeParse(token);
  if (!parsed.success) return { ok: false, error: "Token inválido" };

  const admin = createAdminClient();
  const { data: proposal, error: fetchError } = await admin
    .from("proposals")
    .select("id, status")
    .eq("portal_token", parsed.data)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError || !proposal) return { ok: false, error: "Propuesta no encontrada" };
  if (proposal.status === "accepted" || proposal.status === "rejected") {
    return { ok: false, error: "Esta propuesta ya ha sido respondida" };
  }
  if (proposal.status === "expired") return { ok: false, error: "Propuesta expirada" };
  if (proposal.status === "draft") return { ok: false, error: "Propuesta no disponible" };

  const patch: Record<string, unknown> = {
    status: "rejected",
    responded_at: new Date().toISOString(),
  };
  if (rejectionReason) patch.signature_data = { rejection_reason: rejectionReason };

  const { error: updateError } = await admin.from("proposals").update(patch).eq("id", proposal.id);
  if (updateError) return { ok: false, error: "No se pudo actualizar la propuesta" };

  revalidatePath(`/p/proposal/${parsed.data}`);
  return { ok: true };
}

export async function acceptProposal(token: string, fiscal?: unknown): Promise<ActionResult> {
  return acceptWithFiscal(token, fiscal);
}

export async function rejectProposal(token: string, reason?: string): Promise<ActionResult> {
  const parsedReason = ProposalRejectionReason.safeParse(reason);
  return rejectAction(token, parsedReason.success ? parsedReason.data : undefined);
}
