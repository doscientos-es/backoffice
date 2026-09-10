"use server";

import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import {
  ensureClientForProposal,
  ensureProjectForProposal,
  hasCompleteFiscalData,
  promoteLeadFromClient,
} from "@/lib/crm/conversion";
import { externalAppUrl } from "@/lib/email/app-url";
import { publicEnv, serverEnv } from "@/lib/env";
import { backupProposalToDrive } from "@/lib/google/backup";
import { createRedsysPayment, getRedsysUrl } from "@/lib/integrations/redsys";
import { sendProposalAcceptedEmail } from "@/lib/integrations/send-proposal-accepted-email";
import { createProposalDraftInvoices } from "@/lib/invoices/proposal-drafts";
import { scopedLogger } from "@/lib/logger";
import { dispatchNotifications } from "@/lib/notifications/dispatch";
import { isPortalUnlocked, unlockPortalResource } from "@/lib/portal/access";
import { parseMaintenanceOffer, selectedMaintenancePlan } from "@/lib/proposals/maintenance";
import {
  PROPOSAL_ACCEPTANCE_CONSENT,
  PROPOSAL_ACCEPTANCE_VERSION,
  proposalAcceptanceHash,
  proposalAcceptanceSnapshot,
} from "@/lib/proposals/proposal-acceptance";
import { paymentInitialPercentage, paymentScheduleInput } from "@/lib/proposals/scope";
import {
  AcceptProposalFiscalData,
  type AcceptProposalFiscalDataType,
  AcceptProposalSignature,
  type AcceptProposalSignatureType,
  ProposalPortalToken,
  ProposalRejectionReason,
} from "@/lib/schemas/proposal";
import { createAdminClient } from "@/lib/supabase/admin";

const log = scopedLogger("portal.proposal");

type ActionResult = { ok: true } | { ok: false; error: string };

type PortalAccessControlledProposal = {
  is_client_visible?: boolean | null;
  portal_password_hash?: string | null;
};

function isProposalExpired(validUntil: unknown): boolean {
  return typeof validUntil === "string" && validUntil < new Date().toISOString().slice(0, 10);
}

/** Re-check portal visibility and password for every public server mutation. */
async function requirePublicPortalAccess(
  token: string,
  proposal: PortalAccessControlledProposal,
): Promise<ActionResult> {
  if (proposal.is_client_visible === false) return { ok: false, error: "Propuesta no disponible" };
  const unlocked = await isPortalUnlocked(token, proposal.portal_password_hash ?? null);
  return unlocked
    ? { ok: true }
    : { ok: false, error: "Vuelve a introducir la contraseña del portal" };
}

export type PaymentInitResult =
  | {
      ok: true;
      url: string;
      signatureVersion: string;
      merchantParameters: string;
      signature: string;
    }
  | { ok: false; error: string };

/**
 * Atomically transitions a proposal to `accepted`, performing the fiscal-data
 * upgrade and project creation as a single best-effort sequence:
 *
 *   1. Validate the submitted fiscal data when the destination row lacks it.
 *   2. Promote `lead → client` (or patch missing client fields).
 *   3. Snapshot the accepted fiscal data on the proposal for audit.
 *   4. Flip status to `accepted` (`responded_at` set).
 *   5. Auto-generate the project, prepare invoice drafts and promote the
 *      originating lead to `won`.
 *
 * Steps 1–3 are required: any failure aborts before we flip the status, so
 * an accepted proposal always has a billable client behind it. Steps 4 and
 * 5 are kept as separate writes because PostgREST doesn't give us a single
 * transaction across multiple tables — `ensureClientForProposal` re-points
 * the proposal to the new client_id before we mark it accepted.
 */
/** Best-effort: notifies all owners/admins in-app and by background Push. */
async function notifyAdmins(
  admin: ReturnType<typeof createAdminClient>,
  eventType: string,
  body: string,
  link: string,
): Promise<void> {
  const { data: recipients } = await admin
    .from("team_members")
    .select("id")
    .in("role", ["owner", "admin"])
    .is("deleted_at", null);
  if (!recipients?.length) return;
  await dispatchNotifications({
    recipientIds: recipients.map((r) => r.id as string),
    eventType: eventType as "proposal_accepted" | "proposal_rejected" | "proposal_question",
    entityType: "proposal",
    entityId: link.split("/").pop() ?? "unknown",
    body,
    link,
  });
}

async function acceptWithFiscal(
  token: string,
  signatureInput: unknown,
  fiscalInput: unknown,
): Promise<ActionResult> {
  const parsed = ProposalPortalToken.safeParse(token);
  if (!parsed.success) return { ok: false, error: "Token inválido" };
  const parsedSignature = AcceptProposalSignature.safeParse(signatureInput);
  if (!parsedSignature.success) {
    return {
      ok: false,
      error: parsedSignature.error.errors[0]?.message ?? "La firma no es válida",
    };
  }

  const admin = createAdminClient();
  const { data: proposal, error: fetchError } = await admin
    .from("proposals")
    .select(
      "id, number, status, title, currency, subtotal, tax_amount, total, valid_until, context_markdown, problems, solutions, terms, legal_terms, scope_modules, deliverables, acceptance_criteria, payment_schedule, payment_plan, payment_terms, change_management_terms, maintenance_options, maintenance_selected_plan_id, is_client_visible, portal_password_hash, client_id, lead_id, clients(name, nif, billing_address_street), leads(name, email, phone, company)",
    )
    .eq("portal_token", parsed.data)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError || !proposal) return { ok: false, error: "Propuesta no encontrada" };
  const access = await requirePublicPortalAccess(parsed.data, proposal);
  if (!access.ok) return access;
  if (proposal.status === "accepted" || proposal.status === "rejected") {
    return { ok: false, error: "Esta propuesta ya ha sido respondida" };
  }
  if (proposal.status === "expired" || isProposalExpired(proposal.valid_until)) {
    return { ok: false, error: "Propuesta expirada" };
  }
  if (proposal.status === "draft") return { ok: false, error: "Propuesta no disponible" };

  // Decide whether we need fiscal data: leads always require it, clients
  // only when their row is missing the legal minimum (name + NIF + address).
  const client = (
    proposal as unknown as {
      clients: {
        name: string | null;
        nif: string | null;
        billing_address_street: string | null;
      } | null;
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

  const { data: items, error: itemsError } = await admin
    .from("proposal_items")
    .select("id, description, quantity, unit_price, vat_rate, subtotal, billing_cycle")
    .eq("proposal_id", proposal.id)
    .order("position");
  if (itemsError) return { ok: false, error: "No se pudo preparar la firma de la propuesta" };

  const snapshot = proposalAcceptanceSnapshot(
    proposal as unknown as Record<string, unknown>,
    (items ?? []) as Parameters<typeof proposalAcceptanceSnapshot>[1],
    fiscal,
  );
  const acceptedAt = new Date().toISOString();
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? requestHeaders.get("x-real-ip") ?? "";
  const portalTokenHash = createHash("sha256").update(parsed.data).digest("hex");
  const { error: acceptanceError } = await admin.rpc("accept_proposal_with_evidence", {
    p_proposal_id: proposal.id,
    p_accepted_at: acceptedAt,
    p_signer_name: parsedSignature.data.signer_name,
    p_signer_role: parsedSignature.data.signer_role ?? "",
    p_consent_text: PROPOSAL_ACCEPTANCE_CONSENT,
    p_evidence_version: PROPOSAL_ACCEPTANCE_VERSION,
    p_document_snapshot: snapshot,
    p_document_hash: proposalAcceptanceHash(snapshot),
    p_portal_token_hash: portalTokenHash,
    p_ip: ip,
    p_user_agent: requestHeaders.get("user-agent") ?? "",
  });
  if (acceptanceError) {
    log.warn(
      { err: acceptanceError, proposalId: proposal.id },
      "proposal_electronic_acceptance_failed",
    );
    return { ok: false, error: "No se pudo registrar la firma de la propuesta" };
  }

  if (fiscal) {
    const { error: fiscalSnapshotError } = await admin
      .from("proposals")
      .update({ accepted_fiscal_data: fiscal })
      .eq("id", proposal.id);
    if (fiscalSnapshotError) {
      log.warn(
        { err: fiscalSnapshotError, proposalId: proposal.id },
        "proposal_fiscal_snapshot_failed",
      );
    }
  }

  // Best-effort side-effects: Drive backup, project creation, lead promotion, notification.
  // Failures are logged but never reverse the acceptance — the customer's
  // response is the source of truth.
  void backupProposalToDrive(proposal.id as string);
  const proposalTitle = (proposal as unknown as { title?: string | null }).title;
  const leadData = (proposal as unknown as { leads?: { name?: string | null } | null }).leads;
  const contactName = leadData?.name ?? client?.name ?? null;
  const notifBody = [proposalTitle, contactName].filter(Boolean).join(" · ");
  void notifyAdmins(
    admin,
    "proposal_accepted",
    notifBody || "Propuesta aceptada",
    `/proposals/${proposal.id}`,
  );
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

  try {
    const result = await createProposalDraftInvoices(admin, proposal.id as string, null);
    log.info(
      { proposalId: proposal.id, created: result.created },
      "proposal_invoice_drafts_created",
    );
  } catch (err) {
    log.warn({ err, proposalId: proposal.id }, "proposal_invoice_drafts_failed");
  }

  await sendProposalAcceptedEmail(proposal.id as string);

  revalidatePath(`/p/proposal/${parsed.data}`);
  revalidatePath("/invoices");
  return { ok: true };
}

async function rejectAction(token: string, rejectionReason?: string): Promise<ActionResult> {
  const parsed = ProposalPortalToken.safeParse(token);
  if (!parsed.success) return { ok: false, error: "Token inválido" };

  const admin = createAdminClient();
  const { data: proposal, error: fetchError } = await admin
    .from("proposals")
    .select(
      "id, status, valid_until, title, is_client_visible, portal_password_hash, clients(name), leads(name)",
    )
    .eq("portal_token", parsed.data)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError || !proposal) return { ok: false, error: "Propuesta no encontrada" };
  const access = await requirePublicPortalAccess(parsed.data, proposal);
  if (!access.ok) return access;
  if (proposal.status === "accepted" || proposal.status === "rejected") {
    return { ok: false, error: "Esta propuesta ya ha sido respondida" };
  }
  if (proposal.status === "expired" || isProposalExpired(proposal.valid_until)) {
    return { ok: false, error: "Propuesta expirada" };
  }
  if (proposal.status === "draft") return { ok: false, error: "Propuesta no disponible" };

  const { error: rejectionError } = await admin.rpc("reject_proposal_from_portal", {
    p_proposal_id: proposal.id,
    p_rejected_at: new Date().toISOString(),
    p_rejection_reason: rejectionReason ?? null,
  });
  if (rejectionError) {
    log.warn({ err: rejectionError, proposalId: proposal.id }, "proposal_portal_rejection_failed");
    return { ok: false, error: "No se pudo actualizar la propuesta" };
  }

  const proposalTitle = (proposal as unknown as { title?: string | null }).title;
  const leadData = (proposal as unknown as { leads?: { name?: string | null } | null }).leads;
  const clientData = (proposal as unknown as { clients?: { name?: string | null } | null }).clients;
  const contactName = leadData?.name ?? clientData?.name ?? null;
  const notifBody = [proposalTitle, contactName].filter(Boolean).join(" · ");
  void notifyAdmins(
    admin,
    "proposal_rejected",
    notifBody || "Propuesta rechazada",
    `/proposals/${proposal.id}`,
  );

  revalidatePath(`/p/proposal/${parsed.data}`);
  return { ok: true };
}

export async function acceptProposal(
  token: string,
  signature: AcceptProposalSignatureType,
  fiscal?: unknown,
): Promise<ActionResult> {
  return acceptWithFiscal(token, signature, fiscal);
}

export async function rejectProposal(token: string, reason?: string): Promise<ActionResult> {
  const parsedReason = ProposalRejectionReason.safeParse(reason);
  return rejectAction(token, parsedReason.success ? parsedReason.data : undefined);
}

/** The portal can only change maintenance before the proposal has a final response. */
export async function selectProposalMaintenance(
  token: string,
  planId: string | null,
): Promise<ActionResult> {
  const parsedToken = ProposalPortalToken.safeParse(token);
  if (!parsedToken.success) return { ok: false, error: "Token inválido" };
  if (planId !== null && !z.string().min(1).max(64).safeParse(planId).success) {
    return { ok: false, error: "Plan de mantenimiento no válido" };
  }

  const admin = createAdminClient();
  const { data: proposal, error } = await admin
    .from("proposals")
    .select("id, status, valid_until, is_client_visible, portal_password_hash, maintenance_options")
    .eq("portal_token", parsedToken.data)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !proposal) return { ok: false, error: "Propuesta no encontrada" };
  const access = await requirePublicPortalAccess(parsedToken.data, proposal);
  if (!access.ok) return access;
  if (isProposalExpired(proposal.valid_until)) {
    return { ok: false, error: "El mantenimiento ya no se puede modificar" };
  }
  if (!["sent", "viewed"].includes(proposal.status as string)) {
    return { ok: false, error: "El mantenimiento ya no se puede modificar" };
  }

  const offer = parseMaintenanceOffer(proposal.maintenance_options);
  if (!offer.enabled) {
    return { ok: false, error: "El mantenimiento no está disponible en esta propuesta" };
  }
  if (planId && !selectedMaintenancePlan(offer, planId)) {
    return { ok: false, error: "Este plan no está disponible en la propuesta" };
  }
  const { error: updateError } = await admin
    .from("proposals")
    .update({
      maintenance_options: offer,
      maintenance_selected_plan_id: planId,
      maintenance_selection_source: planId ? "client" : null,
      maintenance_selected_at: planId ? new Date().toISOString() : null,
    })
    .eq("id", proposal.id as string)
    .in("status", ["sent", "viewed"]);
  if (updateError) return { ok: false, error: "No se pudo actualizar el mantenimiento" };

  revalidatePath(`/p/proposal/${parsedToken.data}`);
  return { ok: true };
}

export async function sendProposalQuestion(token: string, body: string): Promise<ActionResult> {
  const parsedToken = ProposalPortalToken.safeParse(token);
  const parsedBody = z.string().trim().min(1).max(2000).safeParse(body);
  if (!parsedToken.success || !parsedBody.success) {
    return { ok: false, error: "La consulta no es válida" };
  }

  const admin = createAdminClient();
  const { data: proposal, error } = await admin
    .from("proposals")
    .select(
      "id, status, valid_until, title, is_client_visible, portal_password_hash, clients(name), leads(name)",
    )
    .eq("portal_token", parsedToken.data)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !proposal) return { ok: false, error: "Propuesta no encontrada" };
  const access = await requirePublicPortalAccess(parsedToken.data, proposal);
  if (!access.ok) return access;
  if (isProposalExpired(proposal.valid_until)) {
    return { ok: false, error: "Esta propuesta ya no admite consultas" };
  }
  if (!["sent", "viewed"].includes(proposal.status as string)) {
    return { ok: false, error: "Esta propuesta ya no admite consultas" };
  }

  const client = (proposal as unknown as { clients: { name: string } | null }).clients;
  const lead = (proposal as unknown as { leads: { name: string } | null }).leads;
  const { error: insertError } = await admin.from("proposal_messages").insert({
    proposal_id: proposal.id,
    author_type: "client",
    author_name: client?.name ?? lead?.name ?? "Cliente",
    body: parsedBody.data,
  });
  if (insertError) return { ok: false, error: "No se pudo enviar la consulta" };

  void notifyAdmins(
    admin,
    "proposal_question",
    `${proposal.title as string}: ${parsedBody.data.slice(0, 120)}`,
    `/proposals/${proposal.id}`,
  );
  revalidatePath(`/p/proposal/${parsedToken.data}`);
  revalidatePath(`/proposals/${proposal.id}`);
  return { ok: true };
}

/** Public unlock-form submit for a password-protected proposal portal link. */
export async function unlockProposalPortal(input: unknown): Promise<ActionResult> {
  return unlockPortalResource("proposals", input);
}

/**
 * Initiates a Redsys payment (deposit/señal) for an accepted proposal.
 */
export async function initiateProposalPayment(
  proposalId: string,
  token: string,
): Promise<PaymentInitResult> {
  const parsedProposalId = z.string().uuid().safeParse(proposalId);
  const parsedToken = ProposalPortalToken.safeParse(token);
  if (!parsedProposalId.success || !parsedToken.success) {
    return { ok: false, error: "Propuesta no disponible para pago" };
  }
  const admin = createAdminClient();
  const appUrl = externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL);

  const { data: proposal } = await admin
    .from("proposals")
    .select("id, status, total, payment_schedule, is_client_visible, portal_password_hash")
    .eq("id", parsedProposalId.data)
    .eq("portal_token", parsedToken.data)
    .is("deleted_at", null)
    .maybeSingle();

  if (proposal?.status !== "accepted") {
    return { ok: false, error: "Propuesta no disponible para pago" };
  }
  const access = await requirePublicPortalAccess(parsedToken.data, proposal);
  if (!access.ok) return { ok: false, error: "Propuesta no disponible para pago" };

  const paymentSchedule = paymentScheduleInput.safeParse(proposal.payment_schedule);
  const initialPercentage = paymentSchedule.success
    ? paymentInitialPercentage(paymentSchedule.data)
    : null;
  if (initialPercentage === null) {
    return { ok: false, error: "La forma de pago seleccionada no admite cobro automático" };
  }
  const amount = Math.round(Number(proposal.total) * initialPercentage) / 100;

  const { data: payment, error: insertError } = await admin.rpc("create_proposal_deposit_payment", {
    p_proposal_id: parsedProposalId.data,
    p_amount: amount,
  });
  const redsysOrder = (payment as Array<{ redsys_order: string }> | null)?.[0]?.redsys_order;

  if (insertError || !redsysOrder) {
    if (insertError?.message === "Ya existe un pago de señal pendiente o confirmado") {
      return { ok: false, error: insertError.message };
    }
    return { ok: false, error: "Error al crear el registro de pago" };
  }

  const env = serverEnv();
  const amountCents = Math.round(amount * 100).toString();

  const redsysData = createRedsysPayment({
    Ds_Merchant_Amount: amountCents,
    Ds_Merchant_Order: redsysOrder,
    Ds_Merchant_MerchantCode: env.REDSYS_MERCHANT_CODE,
    Ds_Merchant_Terminal: env.REDSYS_TERMINAL,
    Ds_Merchant_Currency: env.REDSYS_CURRENCY,
    Ds_Merchant_TransactionType: "0",
    Ds_Merchant_MerchantURL: `${appUrl}/api/webhooks/redsys`,
    Ds_Merchant_UrlOK: `${appUrl}/p/proposal/${parsedToken.data}?success=1`,
    Ds_Merchant_UrlKO: `${appUrl}/p/proposal/${parsedToken.data}?error=1`,
    Ds_Merchant_MerchantData: parsedProposalId.data,
  });

  return {
    ok: true,
    url: getRedsysUrl(),
    signatureVersion: redsysData.Ds_SignatureVersion,
    merchantParameters: redsysData.Ds_MerchantParameters,
    signature: redsysData.Ds_Signature,
  };
}
