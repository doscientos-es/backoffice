import { scopedLogger } from "@/lib/logger";
import type { LeadStatus } from "@/lib/status";
import { notDeleted } from "@/lib/supabase/filters";
import { createServerClient } from "@/lib/supabase/server";
import { escapeIlike } from "@/lib/utils/search-params";
import {
  LEAD_BOARD_LIMIT,
  LEAD_LIST_PAGE_SIZE,
  LEAD_RELATED_LIMIT,
  type LeadConvertResult,
  type LeadDetailInteraction,
  type LeadDetailResult,
  type LeadInteraction,
  type LeadListItem,
  type LeadListParams,
  type LeadListResult,
  type LeadMemberRef,
  RECENT_INTERACTIONS_PER_LEAD,
} from "./types";

/** Embed of the lead owner. Disambiguated via the `assigned_to` FK column. */
const ASSIGNEE_EMBED = "assignee:assigned_to(id, name, avatar_url, github_handle)";

/** Embed of an interaction's author, via the `performed_by` FK column. */
const PERFORMER_EMBED = "performer:performed_by(id, name, avatar_url, github_handle)";

const QUALIFICATION_COLUMNS =
  "company_size, solution_type, urgency, first_contacted_at, landing_path, landing_ref, landing_subject, calculator_cost, calculator_hours, event_id, conversion_step, first_landing_path, first_referrer, first_utm_source, first_utm_medium, first_utm_campaign, first_utm_term, first_utm_content, last_landing_path, last_referrer, last_utm_source, last_utm_medium, last_utm_campaign, last_utm_term, last_utm_content";

/** Mom Test qualification checklist — only needed on the lead detail view. */
const MOM_TEST_COLUMNS =
  "mom_test_real_problem, mom_test_aware_problem, mom_test_tried_solutions, mom_test_decision_power_or_budget, mom_test_accessible";

const LIST_COLUMNS = `id, name, alias, company, email, phone, source, notes, status, created_at, updated_at, estimated_value, score, ${QUALIFICATION_COLUMNS}, ai_summary, ai_updated_at, lost_reason, lost_at, assigned_to, ${ASSIGNEE_EMBED}`;

const DETAIL_COLUMNS = `id, name, alias, email, phone, company, source, status, notes, estimated_value, score, ${QUALIFICATION_COLUMNS}, ${MOM_TEST_COLUMNS}, created_at, updated_at, ai_summary, ai_suggested_next_step, ai_suggested_next_step_at, ai_temperature, ai_confidence, ai_updated_at, ai_tags, lost_reason, lost_at, assigned_to, ${ASSIGNEE_EMBED}`;

const log = scopedLogger("leads.queries");

function sourceFilterValues(source: string): string[] {
  const aliases: Record<string, string[]> = {
    Landing: ["Landing", "landing", "landing_form"],
    "Cal.com": ["Cal.com", "cal.com", "cal"],
    "Anuncios Meta": ["Anuncios Meta", "meta", "meta_lead_ads"],
  };
  return aliases[source] ?? [source];
}

/**
 * Normalises an embedded `team_members` relation into a `LeadMemberRef`.
 * Supabase may surface a to-one embed as either an object or a single-element
 * array, so we handle both and fall back to `null` when unassigned.
 */
function mapMemberRef(value: unknown): LeadMemberRef | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  const m = row as Record<string, unknown>;
  if (typeof m.id !== "string") return null;
  return {
    id: m.id,
    name: (m.name as string | null) ?? "",
    avatar_url: (m.avatar_url as string | null) ?? null,
    github_handle: (m.github_handle as string | null) ?? null,
  };
}

export async function listLeads(params: LeadListParams): Promise<LeadListResult> {
  const supabase = await createServerClient();

  let query = notDeleted(supabase.from("leads").select(LIST_COLUMNS, { count: "exact" }));

  if (params.q.length > 0) {
    const pattern = `%${escapeIlike(params.q)}%`;
    query = query.or(
      `name.ilike.${pattern},company.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`,
    );
  }
  if (params.status) query = query.eq("status", params.status);
  if (params.source) query = query.in("source", sourceFilterValues(params.source));
  if (params.assignee) query = query.eq("assigned_to", params.assignee);

  const from = (params.page - 1) * LEAD_LIST_PAGE_SIZE;
  const to = from + LEAD_LIST_PAGE_SIZE - 1;

  const sortCol = params.sort ?? "created_at";
  const ascending = params.sort ? params.dir !== "desc" : false;
  const { data, error, count } = await (params.view === "list"
    ? query.order(sortCol, { ascending, nullsFirst: false }).range(from, to)
    : query.order("created_at", { ascending: false }).limit(LEAD_BOARD_LIMIT));

  const rows = data ?? [];
  const leadIds = rows.map((r) => r.id as string);
  const interactionsByLead = await loadRecentInteractions(leadIds);

  const leads: LeadListItem[] = rows.map((l) => ({
    id: l.id as string,
    name: l.name as string,
    alias: (l.alias as string | null) ?? null,
    company: (l.company as string | null) ?? null,
    email: (l.email as string | null) ?? null,
    phone: (l.phone as string | null) ?? null,
    source: (l.source as string | null) ?? null,
    notes: (l.notes as string | null) ?? null,
    status: l.status as LeadStatus,
    created_at: l.created_at as string,
    updated_at: (l.updated_at as string | null) ?? (l.created_at as string),
    estimated_value: l.estimated_value == null ? null : Number(l.estimated_value),
    score: l.score == null ? null : Number(l.score),
    company_size: (l.company_size as string | null) ?? null,
    solution_type: (l.solution_type as string | null) ?? null,
    urgency: (l.urgency as string | null) ?? null,
    first_contacted_at: (l.first_contacted_at as string | null) ?? null,
    landing_path: (l.landing_path as string | null) ?? null,
    landing_ref: (l.landing_ref as string | null) ?? null,
    landing_subject: (l.landing_subject as string | null) ?? null,
    conversion_step: (l.conversion_step as string | null) ?? null,
    ai_summary: (l.ai_summary as string | null) ?? null,
    ai_updated_at: (l.ai_updated_at as string | null) ?? null,
    lost_reason: (l.lost_reason as string | null) ?? null,
    lost_at: (l.lost_at as string | null) ?? null,
    assignee: mapMemberRef(l.assignee),
    recent_interactions: interactionsByLead.get(l.id as string) ?? [],
  }));

  return { leads, count: count ?? 0, error: error?.message ?? null };
}

async function loadRecentInteractions(leadIds: string[]): Promise<Map<string, LeadInteraction[]>> {
  const byLead = new Map<string, LeadInteraction[]>();
  if (leadIds.length === 0) return byLead;

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("lead_interactions")
    .select(`id, lead_id, type, subject, body, created_at, ${PERFORMER_EMBED}`)
    .in("lead_id", leadIds)
    .order("created_at", { ascending: false })
    .limit(leadIds.length * RECENT_INTERACTIONS_PER_LEAD);

  for (const i of data ?? []) {
    const leadId = i.lead_id as string;
    const list = byLead.get(leadId) ?? [];
    if (list.length < RECENT_INTERACTIONS_PER_LEAD) {
      list.push({
        id: i.id as string,
        type: i.type as string,
        subject: (i.subject as string | null) ?? null,
        body: (i.body as string | null) ?? null,
        created_at: i.created_at as string,
        performer: mapMemberRef(i.performer),
      });
      byLead.set(leadId, list);
    }
  }
  return byLead;
}

export async function getLeadDetail(id: string): Promise<LeadDetailResult | null> {
  const supabase = await createServerClient();

  const [
    { data: lead, error: leadErr },
    { data: interactions },
    { data: linkedClient },
    { data: reminders },
  ] = await Promise.all([
    notDeleted(supabase.from("leads").select(DETAIL_COLUMNS).eq("id", id)).maybeSingle(),
    supabase
      .from("lead_interactions")
      .select(`id, type, subject, body, created_at, payload, ${PERFORMER_EMBED}`)
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    notDeleted(supabase.from("clients").select("id").eq("lead_id", id)).maybeSingle(),
    supabase
      .from("tasks")
      .select("id, title, start_at")
      .eq("kind", "reminder")
      .eq("lead_id", id)
      .is("completed_at", null)
      .is("deleted_at", null)
      .order("start_at", { ascending: true })
      .limit(LEAD_RELATED_LIMIT),
  ]);

  if (leadErr) log.error({ leadId: id, err: leadErr.message }, "lead_query_failed");
  if (!lead) return null;

  const linkedClientId = (linkedClient?.id as string | undefined) ?? null;

  // Commercial pipeline. Proposals may target the lead directly (lead-first
  // flow) or the linked client once converted; projects and invoices only
  // exist against a client, so we skip them until one is linked.
  const proposalsBuilder = notDeleted(
    supabase.from("proposals").select("id, number, title, status, total"),
  );
  const { data: proposalRows } = await (linkedClientId
    ? proposalsBuilder.or(`lead_id.eq.${id},client_id.eq.${linkedClientId}`)
    : proposalsBuilder.eq("lead_id", id)
  )
    .order("created_at", { ascending: false })
    .limit(LEAD_RELATED_LIMIT);

  let projectRows: Record<string, unknown>[] = [];
  let invoiceRows: Record<string, unknown>[] = [];
  if (linkedClientId) {
    const [{ data: projects }, { data: invoices }] = await Promise.all([
      notDeleted(
        supabase.from("projects").select("id, name, status").eq("client_id", linkedClientId),
      )
        .order("created_at", { ascending: false })
        .limit(LEAD_RELATED_LIMIT),
      notDeleted(
        supabase
          .from("invoices")
          .select("id, full_number, status, total, issue_date")
          .eq("client_id", linkedClientId),
      )
        .order("issue_date", { ascending: false })
        .limit(LEAD_RELATED_LIMIT),
    ]);
    projectRows = (projects ?? []) as Record<string, unknown>[];
    invoiceRows = (invoices ?? []) as Record<string, unknown>[];
  }

  const detailInteractions: LeadDetailInteraction[] = (interactions ?? []).map((i) => ({
    id: i.id as string,
    type: i.type as string,
    subject: (i.subject as string | null) ?? null,
    body: (i.body as string | null) ?? null,
    created_at: i.created_at as string,
    performer: mapMemberRef((i as Record<string, unknown>).performer),
    payload: i.payload ?? null,
  }));

  return {
    lead: lead as unknown as LeadDetailResult["lead"],
    interactions: detailInteractions,
    linkedClientId,
    proposals: (proposalRows ?? []).map((p) => ({
      id: p.id as string,
      number: (p.number as string | null) ?? null,
      title: (p.title as string | null) ?? null,
      status: (p.status as string | null) ?? null,
      total: p.total == null ? null : Number(p.total),
    })),
    projects: projectRows.map((p) => ({
      id: p.id as string,
      name: p.name as string,
      status: (p.status as string | null) ?? null,
    })),
    invoices: invoiceRows.map((i) => ({
      id: i.id as string,
      full_number: (i.full_number as string | null) ?? null,
      status: (i.status as string | null) ?? null,
      total: i.total == null ? null : Number(i.total),
    })),
    reminders: (reminders ?? []).map((r) => ({
      id: r.id as string,
      title: r.title as string,
      remind_at: r.start_at as string,
    })),
  };
}

export async function getLeadForConvert(id: string): Promise<LeadConvertResult | null> {
  const supabase = await createServerClient();

  const [{ data: lead }, { data: existing }] = await Promise.all([
    notDeleted(
      supabase.from("leads").select("id, name, alias, email, phone, company, notes").eq("id", id),
    ).maybeSingle(),
    notDeleted(supabase.from("clients").select("id").eq("lead_id", id)).maybeSingle(),
  ]);

  if (!lead) return null;

  return {
    lead: lead as unknown as LeadConvertResult["lead"],
    existingClientId: (existing?.id as string | undefined) ?? null,
  };
}
