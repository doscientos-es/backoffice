"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { deliveryAcceptanceHash, deliveryNoteSnapshot } from "@/lib/delivery-acceptance";
import { scopedLogger } from "@/lib/logger";
import { parseMaintenanceOffer, selectedMaintenancePlan } from "@/lib/proposals/maintenance";
import { parseScopeModules } from "@/lib/proposals/scope";
import { createServerClient } from "@/lib/supabase/server";

const log = scopedLogger("proposals.delivery");

type ActionResult = { ok: true } | { ok: false; error: string };

const IdInput = z.object({ id: z.string().uuid() });

/**
 * Issues the delivery note (albarán) of an accepted proposal. Any pending
 * note is superseded by the new version, so the latest link is the only one
 * the client can sign.
 */
export async function createDeliveryNote(input: unknown): Promise<ActionResult> {
  const user = await requireRole(["owner", "admin", "member"]);
  const parsed = IdInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ID de propuesta no válido" };
  const proposalId = parsed.data.id;

  const supabase = await createServerClient();
  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .select(
      "id, number, title, status, responded_at, delivered_at, client_id, project_id, scope_modules, deliverables, acceptance_criteria, maintenance_options, maintenance_selected_plan_id, clients(name), projects(name)",
    )
    .eq("id", proposalId)
    .is("deleted_at", null)
    .maybeSingle();
  if (proposalError || !proposal) return { ok: false, error: "Propuesta no encontrada" };
  if (proposal.status !== "accepted") {
    return { ok: false, error: "Solo se puede emitir el albarán de una propuesta aceptada" };
  }
  if (proposal.delivered_at) return { ok: false, error: "El cliente ya firmó el albarán" };
  if (!proposal.client_id) {
    return { ok: false, error: "La propuesta aceptada no tiene cliente asignado" };
  }

  const { data: previous, error: previousError } = await supabase
    .from("delivery_acceptances")
    .select("id, version, status")
    .eq("proposal_id", proposalId)
    .order("version", { ascending: false });
  if (previousError) return { ok: false, error: previousError.message };

  const pendingIds = (previous ?? [])
    .filter((row) => ["draft", "sent", "viewed"].includes(row.status as string))
    .map((row) => row.id as string);
  if (pendingIds.length > 0) {
    const { error: supersedeError } = await supabase
      .from("delivery_acceptances")
      .update({ status: "superseded" })
      .in("id", pendingIds);
    if (supersedeError) return { ok: false, error: supersedeError.message };
  }

  const client = proposal.clients as unknown as { name: string } | null;
  const project = proposal.projects as unknown as { name: string } | null;
  const plan = selectedMaintenancePlan(
    parseMaintenanceOffer(proposal.maintenance_options),
    (proposal.maintenance_selected_plan_id as string | null) ?? null,
  );
  const snapshot = deliveryNoteSnapshot({
    proposalNumber: (proposal.number as string | null) ?? null,
    proposalTitle: proposal.title as string,
    proposalAcceptedAt: (proposal.responded_at as string | null) ?? null,
    clientName: client?.name ?? "El Cliente",
    projectName: project?.name ?? null,
    scopeModules: parseScopeModules(proposal.scope_modules).map((module) => ({
      title: module.title,
      included: module.included,
    })),
    deliverables: (proposal.deliverables as string | null) ?? null,
    acceptanceCriteria: (proposal.acceptance_criteria as string | null) ?? null,
    maintenancePlanName: plan?.name ?? null,
  });

  const { data: created, error: insertError } = await supabase
    .from("delivery_acceptances")
    .insert({
      proposal_id: proposalId,
      project_id: proposal.project_id ?? null,
      client_id: proposal.client_id,
      version: ((previous?.[0]?.version as number | undefined) ?? 0) + 1,
      status: "sent",
      document_snapshot: snapshot,
      document_hash: deliveryAcceptanceHash(snapshot),
      sent_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (insertError || !created) {
    log.error({ err: insertError, proposalId }, "delivery_note_create_failed");
    return { ok: false, error: insertError?.message ?? "No se pudo emitir el albarán" };
  }

  await supabase.from("delivery_acceptance_events").insert({
    delivery_acceptance_id: created.id,
    event_type: "sent",
    actor_type: "team",
    actor_name: user.name,
    actor_email: user.email,
    metadata: {},
  });

  revalidatePath(`/proposals/${proposalId}`);
  return { ok: true };
}

/** Voids a pending delivery note so its link can no longer be signed. */
export async function cancelDeliveryNote(input: unknown): Promise<ActionResult> {
  const user = await requireRole(["owner", "admin", "member"]);
  const parsed = IdInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ID de albarán no válido" };

  const supabase = await createServerClient();
  const { data: cancelled, error } = await supabase
    .from("delivery_acceptances")
    .update({ status: "cancelled" })
    .eq("id", parsed.data.id)
    .in("status", ["sent", "viewed"])
    .select("id, proposal_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!cancelled) return { ok: false, error: "El albarán ya no está pendiente de firma" };

  await supabase.from("delivery_acceptance_events").insert({
    delivery_acceptance_id: cancelled.id,
    event_type: "cancelled",
    actor_type: "team",
    actor_name: user.name,
    actor_email: user.email,
    metadata: {},
  });

  revalidatePath(`/proposals/${cancelled.proposal_id}`);
  return { ok: true };
}
