"use server";

import { ensureProjectForProposal, promoteLeadFromClient } from "@/lib/crm/conversion";
import { scopedLogger } from "@/lib/logger";
import {
  ProposalPortalToken,
  ProposalRejectionReason,
} from "@/lib/schemas/proposal";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

const log = scopedLogger("portal.proposal");

type ActionResult = { ok: true } | { ok: false; error: string };

async function transitionProposal(
  token: string,
  to: "accepted" | "rejected",
  rejectionReason?: string,
): Promise<ActionResult> {
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
    status: to,
    responded_at: new Date().toISOString(),
  };
  if (to === "rejected" && rejectionReason) {
    patch.signature_data = { rejection_reason: rejectionReason };
  }

  const { error: updateError } = await admin.from("proposals").update(patch).eq("id", proposal.id);

  if (updateError) return { ok: false, error: "No se pudo actualizar la propuesta" };

  if (to === "accepted") {
    // Side-effects: ensure a project exists for this proposal and mark the
    // originating lead as `won`. Errors are best-effort and never roll back
    // the acceptance — the customer's response is the source of truth.
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

      log.info(
        { proposalId: proposal.id, projectId },
        "proposal_accepted_side_effects_done",
      );
    } catch (err) {
      log.warn({ err, proposalId: proposal.id }, "proposal_accepted_side_effects_failed");
    }
  }

  revalidatePath(`/p/proposal/${parsed.data}`);
  return { ok: true };
}

export async function acceptProposal(token: string): Promise<ActionResult> {
  return transitionProposal(token, "accepted");
}

export async function rejectProposal(token: string, reason?: string): Promise<ActionResult> {
  const parsedReason = ProposalRejectionReason.safeParse(reason);
  return transitionProposal(
    token,
    "rejected",
    parsedReason.success ? parsedReason.data : undefined,
  );
}
