import { scopedLogger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LeadIntake } from "./lead-intake";

const log = scopedLogger("lead-pipeline");

// ── Scoring ───────────────────────────────────────────────────────────────

const PAID_MEDIUMS = new Set([
  "paid_social",
  "paid",
  "cpc",
  "cpm",
  "ppc",
  "paidsocial",
  "display",
]);

/**
 * Rule-based lead score (0–100).
 *
 * Contact completeness (+55):  email +20, phone +20, company +15
 * Message quality       (+10):  has notes
 * Paid attribution      (+25):  paid medium +15, campaign present +10
 * Context               (+10):  referrer +5, Spanish language +5
 */
export function scoreLeadIntake(input: LeadIntake): number {
  let score = 0;

  // Contact completeness
  if (input.email) score += 20;
  if (input.phone) score += 20;
  if (input.company) score += 15;

  // Message quality
  if (input.notes) score += 10;

  // Paid attribution
  if (input.utm?.medium && PAID_MEDIUMS.has(input.utm.medium.toLowerCase())) score += 15;
  if (input.utm?.campaign) score += 10;

  // Context
  if (input.context?.referrer) score += 5;
  if (input.context?.language?.toLowerCase().startsWith("es")) score += 5;

  return Math.min(score, 100);
}

// ── Round-robin assignment ────────────────────────────────────────────────

/**
 * Returns the id of the team member with the fewest leads assigned in the last
 * 30 days. Tie-break: earliest `created_at` (most senior member).
 * Returns null when no active members exist.
 */
async function pickRoundRobinAssignee(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<string | null> {
  const { data: members, error } = await supabase
    .from("team_members")
    .select("id")
    .is("deleted_at", null)
    .order("created_at"); // oldest first → tie-break

  if (error || !members?.length) return null;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: recent } = await supabase
    .from("leads")
    .select("assigned_to")
    .is("deleted_at", null)
    .not("assigned_to", "is", null)
    .gte("created_at", thirtyDaysAgo);

  // Build count map, initialising every active member at 0
  const counts = new Map<string, number>(members.map((m) => [m.id as string, 0]));
  for (const lead of recent ?? []) {
    const id = lead.assigned_to as string | null;
    if (id && counts.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  // Pick member with the lowest count (order preserves tie-break)
  let minId: string | null = null;
  let minCount = Infinity;
  for (const [id, count] of counts) {
    if (count < minCount) {
      minCount = count;
      minId = id;
    }
  }

  return minId;
}

// ── Pipeline entry point ──────────────────────────────────────────────────

/**
 * Post-insert pipeline executed for every lead entering via ingestLead().
 *
 * Steps:
 *   1. Compute rule-based score (0–100).
 *   2. Pick round-robin assignee (fewest leads in last 30 days).
 *   3. Persist both on the lead row.
 *
 * Errors are logged and never propagate — callers should invoke
 * with `.catch(() => {})` so lead creation is never blocked.
 */
export async function runLeadPipeline(leadId: string, input: LeadIntake): Promise<void> {
  const supabase = createAdminClient();

  try {
    const score = scoreLeadIntake(input);
    const assignedTo = await pickRoundRobinAssignee(supabase);

    const updates: Record<string, unknown> = { score };
    if (assignedTo) updates.assigned_to = assignedTo;

    const { error } = await supabase.from("leads").update(updates).eq("id", leadId);

    if (error) {
      log.error({ err: error, leadId }, "pipeline update failed");
    } else {
      log.info({ leadId, score, assigned: Boolean(assignedTo) }, "lead pipeline applied");
    }
  } catch (e) {
    log.error({ err: e, leadId }, "lead pipeline threw unexpectedly");
  }
}
