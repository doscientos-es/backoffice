"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const TokenSchema = z.string().min(32).max(128).regex(/^[a-f0-9]+$/i);
const RejectionSchema = z.string().max(500).optional();

type ActionResult = { ok: true } | { ok: false; error: string };

async function transitionProposal(
  token: string,
  to: "accepted" | "rejected",
  rejectionReason?: string,
): Promise<ActionResult> {
  const parsed = TokenSchema.safeParse(token);
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

  const { error: updateError } = await admin
    .from("proposals")
    .update(patch)
    .eq("id", proposal.id);

  if (updateError) return { ok: false, error: "No se pudo actualizar la propuesta" };

  revalidatePath(`/p/proposal/${parsed.data}`);
  return { ok: true };
}

export async function acceptProposal(token: string): Promise<ActionResult> {
  return transitionProposal(token, "accepted");
}

export async function rejectProposal(
  token: string,
  reason?: string,
): Promise<ActionResult> {
  const parsedReason = RejectionSchema.safeParse(reason);
  return transitionProposal(token, "rejected", parsedReason.success ? parsedReason.data : undefined);
}
