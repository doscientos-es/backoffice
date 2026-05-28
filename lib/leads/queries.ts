import type { LeadStatus } from "@/lib/status";
import { notDeleted } from "@/lib/supabase/filters";
import { createServerClient } from "@/lib/supabase/server";
import {
  LEAD_BOARD_LIMIT,
  LEAD_LIST_PAGE_SIZE,
  type LeadConvertResult,
  type LeadDetailInteraction,
  type LeadDetailResult,
  type LeadInteraction,
  type LeadListItem,
  type LeadListParams,
  type LeadListResult,
  RECENT_INTERACTIONS_PER_LEAD,
} from "./types";

const LIST_COLUMNS =
  "id, name, company, email, phone, source, notes, status, created_at, updated_at, estimated_value, ai_summary, ai_updated_at";

const DETAIL_COLUMNS =
  "id, name, email, phone, company, source, status, notes, estimated_value, created_at, updated_at, ai_summary, ai_suggested_next_step, ai_temperature, ai_confidence, ai_updated_at, lost_reason, lost_at";

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (m) => `\\${m}`);
}

export async function listLeads(params: LeadListParams): Promise<LeadListResult> {
  const supabase = await createServerClient();

  let query = notDeleted(
    supabase.from("leads").select(LIST_COLUMNS, { count: "exact" }),
  );

  if (params.view === "list") {
    if (params.q.length > 0) {
      const pattern = `%${escapeIlike(params.q)}%`;
      query = query.or(
        `name.ilike.${pattern},company.ilike.${pattern},email.ilike.${pattern}`,
      );
    }
    if (params.status) query = query.eq("status", params.status);
    if (params.source) query = query.eq("source", params.source);
  }

  const from = (params.page - 1) * LEAD_LIST_PAGE_SIZE;
  const to = from + LEAD_LIST_PAGE_SIZE - 1;

  const { data, error, count } = await (params.view === "list"
    ? query.order("created_at", { ascending: false }).range(from, to)
    : query.order("created_at", { ascending: false }).limit(LEAD_BOARD_LIMIT));

  const rows = data ?? [];
  const leadIds = rows.map((r) => r.id as string);
  const interactionsByLead = await loadRecentInteractions(leadIds);

  const leads: LeadListItem[] = rows.map((l) => ({
    id: l.id as string,
    name: l.name as string,
    company: (l.company as string | null) ?? null,
    email: (l.email as string | null) ?? null,
    phone: (l.phone as string | null) ?? null,
    source: (l.source as string | null) ?? null,
    notes: (l.notes as string | null) ?? null,
    status: l.status as LeadStatus,
    created_at: l.created_at as string,
    updated_at: (l.updated_at as string | null) ?? (l.created_at as string),
    estimated_value: l.estimated_value == null ? null : Number(l.estimated_value),
    ai_summary: (l.ai_summary as string | null) ?? null,
    ai_updated_at: (l.ai_updated_at as string | null) ?? null,
    recent_interactions: interactionsByLead.get(l.id as string) ?? [],
  }));

  return { leads, count: count ?? 0, error: error?.message ?? null };
}

async function loadRecentInteractions(
  leadIds: string[],
): Promise<Map<string, LeadInteraction[]>> {
  const byLead = new Map<string, LeadInteraction[]>();
  if (leadIds.length === 0) return byLead;

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("lead_interactions")
    .select("id, lead_id, type, subject, body, created_at")
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
      });
      byLead.set(leadId, list);
    }
  }
  return byLead;
}

export async function getLeadDetail(id: string): Promise<LeadDetailResult | null> {
  const supabase = await createServerClient();

  const [{ data: lead }, { data: interactions }, { data: linkedClient }] = await Promise.all([
    notDeleted(supabase.from("leads").select(DETAIL_COLUMNS).eq("id", id)).maybeSingle(),
    supabase
      .from("lead_interactions")
      .select("id, type, subject, body, created_at, payload")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    notDeleted(supabase.from("clients").select("id").eq("lead_id", id)).maybeSingle(),
  ]);

  if (!lead) return null;

  const detailInteractions: LeadDetailInteraction[] = (interactions ?? []).map((i) => ({
    id: i.id as string,
    type: i.type as string,
    subject: (i.subject as string | null) ?? null,
    body: (i.body as string | null) ?? null,
    created_at: i.created_at as string,
    payload: i.payload ?? null,
  }));

  return {
    lead: lead as unknown as LeadDetailResult["lead"],
    interactions: detailInteractions,
    linkedClientId: (linkedClient?.id as string | undefined) ?? null,
  };
}

export async function getLeadForConvert(id: string): Promise<LeadConvertResult | null> {
  const supabase = await createServerClient();

  const [{ data: lead }, { data: existing }] = await Promise.all([
    notDeleted(
      supabase.from("leads").select("id, name, email, phone, company, notes").eq("id", id),
    ).maybeSingle(),
    notDeleted(supabase.from("clients").select("id").eq("lead_id", id)).maybeSingle(),
  ]);

  if (!lead) return null;

  return {
    lead: lead as unknown as LeadConvertResult["lead"],
    existingClientId: (existing?.id as string | undefined) ?? null,
  };
}
