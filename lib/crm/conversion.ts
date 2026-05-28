import { scopedLogger } from "@/lib/logger";
import type { AcceptProposalFiscalDataType } from "@/lib/schemas/proposal";
import type { SupabaseClient } from "@supabase/supabase-js";

const log = scopedLogger("crm.conversion");

// Accepts both the SSR (RLS) and the admin Supabase clients. The generics are
// intentionally loose because callers instantiate them with different schemas.
// biome-ignore lint/suspicious/noExplicitAny: structural compatibility across client variants
type AnyClient = SupabaseClient<any, any, any>;

/**
 * Returns true when a `clients` row has the minimum fiscal data required
 * to bill it (Verifactu): name, NIF and billing address. Used by the
 * portal to decide whether the lead/client must fill the fiscal form
 * before they can accept a proposal.
 */
export function hasCompleteFiscalData(client: {
  name: string | null;
  nif: string | null;
  billing_address: string | null;
}): boolean {
  return Boolean(client.name?.trim() && client.nif?.trim() && client.billing_address?.trim());
}

/**
 * Promotes the lead linked to a client (via `clients.lead_id`) to `won`.
 *
 * Idempotent and best-effort: any DB error is logged and swallowed so callers
 * (proposal acceptance, invoice issuance) never fail because of side-effects.
 */
export async function promoteLeadFromClient(
  client: AnyClient,
  clientId: string,
): Promise<{ leadId: string | null; promoted: boolean }> {
  try {
    const { data, error } = await client
      .from("clients")
      .select("lead_id")
      .eq("id", clientId)
      .maybeSingle();
    if (error || !data?.lead_id) return { leadId: null, promoted: false };

    const leadId = data.lead_id as string;

    const { data: lead, error: leadErr } = await client
      .from("leads")
      .select("status")
      .eq("id", leadId)
      .maybeSingle();
    if (leadErr || !lead) return { leadId, promoted: false };

    if (lead.status === "won" || lead.status === "lost") {
      return { leadId, promoted: false };
    }

    const { error: updateErr } = await client
      .from("leads")
      .update({ status: "won", updated_at: new Date().toISOString() })
      .eq("id", leadId);
    if (updateErr) {
      log.warn({ err: updateErr, leadId }, "lead_promote_failed");
      return { leadId, promoted: false };
    }

    await client.from("lead_interactions").insert({
      lead_id: leadId,
      type: "note",
      subject: "Lead ganado",
      body: "Promovido automáticamente a `won`.",
    });

    return { leadId, promoted: true };
  } catch (err) {
    log.warn({ err, clientId }, "promote_lead_unexpected");
    return { leadId: null, promoted: false };
  }
}

/**
 * Ensures the proposal has an associated project. If `proposals.project_id`
 * is null, creates an `active` project named after the proposal — copying
 * the narrative context, validity date and notes — and links it back.
 * Idempotent: returns the existing project_id when already set.
 *
 * Best-effort: errors are logged and swallowed.
 */
export async function ensureProjectForProposal(
  client: AnyClient,
  proposalId: string,
): Promise<{ projectId: string | null; created: boolean }> {
  try {
    const { data: proposal, error } = await client
      .from("proposals")
      .select("client_id, project_id, title, context_markdown, notes, valid_until")
      .eq("id", proposalId)
      .maybeSingle();
    if (error || !proposal?.client_id) return { projectId: null, created: false };

    if (proposal.project_id) {
      return { projectId: proposal.project_id as string, created: false };
    }

    const projectName = ((proposal.title as string | null) ?? "").trim() || "Proyecto sin título";
    // Project description prefers the proposal narrative context, falling
    // back to internal notes so the project lands with useful detail.
    const description =
      ((proposal.context_markdown as string | null) ?? "").trim() ||
      ((proposal.notes as string | null) ?? "").trim() ||
      null;

    const { data: project, error: insertErr } = await client
      .from("projects")
      .insert({
        client_id: proposal.client_id,
        name: projectName,
        description,
        status: "active",
        starts_at: new Date().toISOString().slice(0, 10),
        ends_at: (proposal.valid_until as string | null) ?? null,
      })
      .select("id")
      .single();
    if (insertErr || !project) {
      log.warn({ err: insertErr, proposalId }, "project_create_failed");
      return { projectId: null, created: false };
    }

    const projectId = project.id as string;
    const { error: linkErr } = await client
      .from("proposals")
      .update({ project_id: projectId })
      .eq("id", proposalId);
    if (linkErr) {
      log.warn({ err: linkErr, proposalId, projectId }, "project_link_failed");
    }

    return { projectId, created: true };
  } catch (err) {
    log.warn({ err, proposalId }, "ensure_project_unexpected");
    return { projectId: null, created: false };
  }
}

/**
 * Ensures the proposal targets a billable `clients` row, using the fiscal
 * data the lead submitted on the portal. Three cases:
 *
 *   1. proposal.client_id already set → patch missing fiscal fields only
 *      (don't overwrite existing values; the back-office is the source of
 *      truth once a client exists).
 *   2. proposal.lead_id set with a client already linked via `clients.lead_id`
 *      → reuse it, patch missing fiscal fields, and re-point the proposal.
 *   3. proposal.lead_id set without a linked client → create a fresh client
 *      from the submitted fiscal data, link it to the lead, and re-point
 *      the proposal so future invoices flow to it.
 */
export async function ensureClientForProposal(
  client: AnyClient,
  proposalId: string,
  fiscal: AcceptProposalFiscalDataType,
): Promise<{ clientId: string; created: boolean } | { error: string }> {
  const { data: proposal, error: readErr } = await client
    .from("proposals")
    .select("client_id, lead_id")
    .eq("id", proposalId)
    .maybeSingle();
  if (readErr || !proposal) return { error: "Propuesta no encontrada" };

  if (proposal.client_id) {
    await patchMissingClientFiscal(client, proposal.client_id as string, fiscal);
    return { clientId: proposal.client_id as string, created: false };
  }

  if (!proposal.lead_id) {
    return { error: "La propuesta no tiene destinatario" };
  }
  const leadId = proposal.lead_id as string;

  const { data: existing } = await client
    .from("clients")
    .select("id")
    .eq("lead_id", leadId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing?.id) {
    const clientId = existing.id as string;
    await patchMissingClientFiscal(client, clientId, fiscal);
    await client
      .from("proposals")
      .update({ client_id: clientId, lead_id: null })
      .eq("id", proposalId);
    return { clientId, created: false };
  }

  const { data: created, error: insertErr } = await client
    .from("clients")
    .insert({
      lead_id: leadId,
      name: fiscal.name,
      nif: fiscal.nif,
      billing_address: fiscal.billing_address,
      email: fiscal.email ?? null,
      phone: fiscal.phone ?? null,
      contact_person: fiscal.contact_person ?? null,
    })
    .select("id")
    .single();
  if (insertErr || !created) {
    log.warn({ err: insertErr, proposalId, leadId }, "client_create_failed");
    return { error: insertErr?.message ?? "No se pudo crear el cliente" };
  }

  const clientId = created.id as string;
  await client
    .from("proposals")
    .update({ client_id: clientId, lead_id: null })
    .eq("id", proposalId);
  return { clientId, created: true };
}

/**
 * Patches only the fiscal fields that are currently blank on the client
 * row. Existing values are never overwritten — the back-office is the
 * source of truth once a client has been onboarded.
 */
async function patchMissingClientFiscal(
  client: AnyClient,
  clientId: string,
  fiscal: AcceptProposalFiscalDataType,
): Promise<void> {
  const { data: row } = await client
    .from("clients")
    .select("name, nif, billing_address, email, phone, contact_person")
    .eq("id", clientId)
    .maybeSingle();
  if (!row) return;

  const patch: Record<string, unknown> = {};
  if (!row.nif && fiscal.nif) patch.nif = fiscal.nif;
  if (!row.billing_address && fiscal.billing_address)
    patch.billing_address = fiscal.billing_address;
  if (!row.email && fiscal.email) patch.email = fiscal.email;
  if (!row.phone && fiscal.phone) patch.phone = fiscal.phone;
  if (!row.contact_person && fiscal.contact_person) patch.contact_person = fiscal.contact_person;

  if (Object.keys(patch).length === 0) return;
  await client.from("clients").update(patch).eq("id", clientId);
}
