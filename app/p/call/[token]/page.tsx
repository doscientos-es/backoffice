import { notFound } from "next/navigation";

import { isCallSessionStatus } from "@/lib/leads/call-session";
import { createAdminClient } from "@/lib/supabase/admin";

import { MobileCallSession } from "./mobile-call-session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Llamada · doscientos",
  robots: { index: false, follow: false },
};

export default async function MobileCallPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    notFound();
  }
  const { data: session } = await createAdminClient()
    .from("lead_call_sessions")
    .select("status, expires_at, lead_id, leads(id, name, company, phone, status, estimated_value)")
    .eq("mobile_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  const lead = Array.isArray(session?.leads) ? session.leads[0] : session?.leads;
  const phone = lead?.phone;
  if (!phone || !session || !isCallSessionStatus(session.status)) notFound();

  const supabase = await createAdminClient();
  const leadId = session.lead_id as string;
  const [{ data: questions }, { data: linkedClient }] = await Promise.all([
    supabase
      .from("lead_discovery_questions")
      .select("question, status, priority")
      .eq("lead_id", leadId)
      .in("status", ["open", "needs_review", "deferred"])
      .order("priority", { ascending: true })
      .order("sort_order", { ascending: true })
      .limit(5),
    supabase
      .from("clients")
      .select("id")
      .eq("lead_id", leadId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  const clientId = linkedClient?.id as string | undefined;
  const proposalsQuery = supabase
    .from("proposals")
    .select("title, status, total")
    .is("deleted_at", null);
  const [{ data: proposals }, { data: clientProposals }, { data: invoices }] = await Promise.all([
    proposalsQuery.eq("lead_id", leadId).order("created_at", { ascending: false }).limit(3),
    clientId
      ? supabase
          .from("proposals")
          .select("title, status, total")
          .eq("client_id", clientId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(3)
      : Promise.resolve({ data: [] as Array<{ title: string; status: string; total: number }> }),
    clientId
      ? supabase
          .from("invoices")
          .select("id, full_number, status, total")
          .eq("client_id", clientId)
          .is("deleted_at", null)
          .order("issue_date", { ascending: false })
          .limit(20)
      : Promise.resolve({
          data: [] as Array<{ id: string; full_number: string; status: string; total: number }>,
        }),
  ]);

  const invoiceIds = (invoices ?? []).map((invoice) => invoice.id);
  const { data: payments } = invoiceIds.length
    ? await supabase
        .from("invoice_payments")
        .select("invoice_id, amount")
        .in("invoice_id", invoiceIds)
        .eq("status", "confirmed")
    : { data: [] as Array<{ invoice_id: string; amount: number }> };
  const paidByInvoice = new Map<string, number>();
  for (const payment of payments ?? []) {
    paidByInvoice.set(
      payment.invoice_id,
      (paidByInvoice.get(payment.invoice_id) ?? 0) + Number(payment.amount),
    );
  }
  const issuedInvoices = (invoices ?? []).filter(
    (invoice) =>
      invoice.status !== "draft" &&
      invoice.status !== "cancelled" &&
      invoice.status !== "rectified",
  );
  const paidTotal = issuedInvoices.reduce(
    (sum, invoice) => sum + (paidByInvoice.get(invoice.id) ?? 0),
    0,
  );
  const outstandingTotal = issuedInvoices.reduce(
    (sum, invoice) =>
      sum + Math.max(0, Number(invoice.total) - (paidByInvoice.get(invoice.id) ?? 0)),
    0,
  );

  return (
    <MobileCallSession
      token={token}
      phone={phone as string}
      status={session.status}
      briefing={{
        name: (lead?.name as string | null) ?? "Lead",
        company: (lead?.company as string | null) ?? null,
        leadStatus: (lead?.status as string | null) ?? null,
        estimatedValue: lead?.estimated_value == null ? null : Number(lead.estimated_value),
        questions: (questions ?? []).map((question) => ({
          question: question.question as string,
          status: question.status as string,
        })),
        proposals: [...(proposals ?? []), ...(clientProposals ?? [])]
          .filter(
            (proposal, index, all) =>
              all.findIndex(
                (item) =>
                  item.title === proposal.title &&
                  item.status === proposal.status &&
                  item.total === proposal.total,
              ) === index,
          )
          .slice(0, 3)
          .map((proposal) => ({
            title: (proposal.title as string | null) ?? "Propuesta",
            status: proposal.status as string,
            total: Number(proposal.total ?? 0),
          })),
        invoiceCount: issuedInvoices.length,
        paidTotal,
        outstandingTotal,
      }}
    />
  );
}
