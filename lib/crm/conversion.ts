import { scopedLogger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

const log = scopedLogger("crm.conversion");

// Accepts both the SSR (RLS) and the admin Supabase clients. The generics are
// intentionally loose because callers instantiate them with different schemas.
// biome-ignore lint/suspicious/noExplicitAny: structural compatibility across client variants
type AnyClient = SupabaseClient<any, any, any>;

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
 * is null, creates an `active` project named after the proposal and links it
 * back. Idempotent: returns the existing project_id when already set.
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
      .select("client_id, project_id, title")
      .eq("id", proposalId)
      .maybeSingle();
    if (error || !proposal?.client_id) return { projectId: null, created: false };

    if (proposal.project_id) {
      return { projectId: proposal.project_id as string, created: false };
    }

    const projectName = ((proposal.title as string | null) ?? "").trim() || "Proyecto sin título";

    const { data: project, error: insertErr } = await client
      .from("projects")
      .insert({
        client_id: proposal.client_id,
        name: projectName,
        status: "active",
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
