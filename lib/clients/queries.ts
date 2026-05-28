import { scopedLogger } from "@/lib/logger";
import { notDeleted } from "@/lib/supabase/filters";
import { createServerClient } from "@/lib/supabase/server";
import {
  CLIENT_LIST_PAGE_SIZE,
  CLIENT_PROJECTS_LIMIT,
  CLIENT_RELATED_LIMIT,
  type ClientDetailResult,
  type ClientListParams,
  type ClientListResult,
} from "./types";

const log = scopedLogger("clients.queries");

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (m) => `\\${m}`);
}

export async function listClients(params: ClientListParams): Promise<ClientListResult> {
  const supabase = await createServerClient();
  const page = Math.max(1, params.page ?? 1);
  const from = (page - 1) * CLIENT_LIST_PAGE_SIZE;
  const to = from + CLIENT_LIST_PAGE_SIZE - 1;

  let query = notDeleted(
    supabase
      .from("clients")
      .select("id, name, nif, email, phone, contact_person, updated_at", { count: "exact" }),
  );

  if (params.q && params.q.length > 0) {
    const p = `%${escapeIlike(params.q)}%`;
    query = query.or(`name.ilike.${p},nif.ilike.${p},email.ilike.${p}`);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) log.error({ err: error.message }, "list_clients_failed");

  return {
    data: (data ?? []).map((c) => ({
      id: c.id as string,
      name: c.name as string,
      nif: (c.nif as string | null) ?? null,
      email: (c.email as string | null) ?? null,
      phone: (c.phone as string | null) ?? null,
      contact_person: (c.contact_person as string | null) ?? null,
      updated_at: (c.updated_at as string | null) ?? null,
    })),
    count: count ?? 0,
  };
}

export async function getClientDetail(id: string): Promise<ClientDetailResult> {
  const supabase = await createServerClient();

  const { data: client, error } = await notDeleted(
    supabase.from("clients").select("*").eq("id", id),
  ).maybeSingle();

  if (error) log.error({ clientId: id, err: error.message }, "get_client_detail_failed");
  if (!client) return null;

  const [{ data: projects }, { data: proposals }, { data: invoices }] = await Promise.all([
    notDeleted(supabase.from("projects").select("id, name, status").eq("client_id", id))
      .order("created_at", { ascending: false })
      .limit(CLIENT_PROJECTS_LIMIT),
    notDeleted(
      supabase.from("proposals").select("id, number, title, status, total").eq("client_id", id),
    )
      .order("created_at", { ascending: false })
      .limit(CLIENT_RELATED_LIMIT),
    notDeleted(
      supabase
        .from("invoices")
        .select("id, full_number, status, total, issue_date")
        .eq("client_id", id),
    )
      .order("issue_date", { ascending: false })
      .limit(CLIENT_RELATED_LIMIT),
  ]);

  return {
    client: {
      id: client.id as string,
      name: client.name as string,
      nif: (client.nif as string | null) ?? null,
      email: (client.email as string | null) ?? null,
      phone: (client.phone as string | null) ?? null,
      contact_person: (client.contact_person as string | null) ?? null,
      billing_address: (client.billing_address as string | null) ?? null,
      notes: (client.notes as string | null) ?? null,
      created_at: (client.created_at as string | null) ?? null,
      updated_at: (client.updated_at as string | null) ?? null,
    },
    projects: (projects ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      status: (p.status as string | null) ?? null,
    })),
    proposals: (proposals ?? []).map((p) => ({
      id: p.id as string,
      number: (p.number as string | null) ?? null,
      title: (p.title as string | null) ?? null,
      status: (p.status as string | null) ?? null,
      total: p.total == null ? null : Number(p.total),
    })),
    invoices: (invoices ?? []).map((i) => ({
      id: i.id as string,
      full_number: (i.full_number as string | null) ?? null,
      status: (i.status as string | null) ?? null,
      total: i.total == null ? null : Number(i.total),
      issue_date: (i.issue_date as string | null) ?? null,
    })),
  };
}
