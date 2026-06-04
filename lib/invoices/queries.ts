import { scopedLogger } from "@/lib/logger";
import { notDeleted } from "@/lib/supabase/filters";
import { createServerClient } from "@/lib/supabase/server";
import {
  INVOICE_LIST_PAGE_SIZE,
  type InvoiceDetailResult,
  type InvoiceListParams,
  type InvoiceListResult,
} from "./types";

const log = scopedLogger("invoices.queries");

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (m) => `\\${m}`);
}

export async function listInvoices(params: InvoiceListParams): Promise<InvoiceListResult> {
  const supabase = await createServerClient();
  const page = Math.max(1, params.page ?? 1);
  const from = (page - 1) * INVOICE_LIST_PAGE_SIZE;
  const to = from + INVOICE_LIST_PAGE_SIZE - 1;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const [listRes, pendingRes, overdueRes, paidMonthRes, verifactuKoRes] = await Promise.all([
    (() => {
      let query = notDeleted(
        supabase
          .from("invoices")
          .select(
            "id, full_number, idfact, status, verifactu_status, total, issue_date, due_date",
            { count: "exact" },
          ),
      );
      if (params.q && params.q.length > 0) {
        const pattern = `%${escapeIlike(params.q)}%`;
        query = query.or(`full_number.ilike.${pattern},idfact.ilike.${pattern}`);
      }
      if (params.status) query = query.eq("status", params.status);
      if (params.verifactu) query = query.eq("verifactu_status", params.verifactu);
      return query.order("issue_date", { ascending: false }).range(from, to);
    })(),
    notDeleted(supabase.from("invoices").select("total", { count: "exact" })).eq(
      "status",
      "issued",
    ),
    notDeleted(supabase.from("invoices").select("total", { count: "exact" })).eq(
      "status",
      "overdue",
    ),
    notDeleted(supabase.from("invoices").select("total"))
      .eq("status", "paid")
      .gte("issue_date", monthStart),
    notDeleted(supabase.from("invoices").select("id", { count: "exact", head: true })).eq(
      "verifactu_status",
      "rejected",
    ),
  ]);

  if (listRes.error) log.error({ err: listRes.error.message }, "list_invoices_failed");

  const pendingTotal = (pendingRes.data ?? []).reduce((acc, r) => acc + Number(r.total ?? 0), 0);
  const overdueTotal = (overdueRes.data ?? []).reduce((acc, r) => acc + Number(r.total ?? 0), 0);
  const paidMonthTotal = (paidMonthRes.data ?? []).reduce(
    (acc, r) => acc + Number(r.total ?? 0),
    0,
  );

  return {
    data: (listRes.data ?? []).map((i) => ({
      id: i.id as string,
      full_number: (i.full_number as string | null) ?? null,
      idfact: (i.idfact as string | null) ?? null,
      status: (i.status as string | null) ?? null,
      verifactu_status: (i.verifactu_status as string | null) ?? null,
      total: i.total == null ? null : Number(i.total),
      issue_date: (i.issue_date as string | null) ?? null,
      due_date: (i.due_date as string | null) ?? null,
    })),
    count: listRes.count ?? 0,
    stats: {
      pendingTotal,
      pendingCount: pendingRes.count ?? 0,
      overdueTotal,
      overdueCount: overdueRes.count ?? 0,
      paidMonthTotal,
      verifactuKoCount: verifactuKoRes.count ?? 0,
    },
  };
}

export async function getInvoiceDetail(id: string): Promise<InvoiceDetailResult> {
  const supabase = await createServerClient();

  const { data: invoice, error } = await notDeleted(
    supabase.from("invoices").select("*, clients(id, name), projects(id, name)").eq("id", id),
  ).maybeSingle();

  if (error) log.error({ invoiceId: id, err: error.message }, "get_invoice_detail_failed");
  if (!invoice) return null;

  const [{ data: items }, { data: settings }] = await Promise.all([
    supabase
      .from("invoice_items")
      .select("id, position, description, quantity, unit_price, vat_rate, subtotal")
      .eq("invoice_id", id)
      .order("position"),
    supabase
      .from("settings")
      .select("company_name, company_nif, company_address, iban")
      .eq("id", 1)
      .single(),
  ]);

  const client =
    (invoice as unknown as { clients: { id: string; name: string } | null }).clients ?? null;
  const project =
    (invoice as unknown as { projects: { id: string; name: string } | null }).projects ?? null;

  return {
    invoice: {
      id: invoice.id as string,
      full_number: (invoice.full_number as string | null) ?? null,
      idfact: (invoice.idfact as string | null) ?? null,
      invoice_type: (invoice.invoice_type as string | null) ?? null,
      status: (invoice.status as string | null) ?? null,
      verifactu_status: (invoice.verifactu_status as string | null) ?? null,
      verifactu_csv: (invoice.verifactu_csv as string | null) ?? null,
      subtotal: invoice.subtotal == null ? null : Number(invoice.subtotal),
      total: invoice.total == null ? null : Number(invoice.total),
      issue_date: (invoice.issue_date as string | null) ?? null,
      due_date: (invoice.due_date as string | null) ?? null,
      client_nif: (invoice.client_nif as string | null) ?? null,
      client,
      project,
    },
    items: (items ?? []).map((item) => ({
      id: item.id as string,
      position: (item.position as number | null) ?? null,
      description: (item.description as string | null) ?? null,
      quantity: (item.quantity as number | null) ?? null,
      unit_price: (item.unit_price as number | null) ?? null,
      vat_rate: (item.vat_rate as number | null) ?? null,
      subtotal: (item.subtotal as number | null) ?? null,
    })),
    settings: settings
      ? {
          company_name: (settings.company_name as string | null) ?? null,
          company_nif: (settings.company_nif as string | null) ?? null,
          company_address: (settings.company_address as string | null) ?? null,
          iban: (settings.iban as string | null) ?? null,
        }
      : null,
  };
}
