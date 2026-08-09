import { notDeleted } from "@/lib/supabase/filters";
import { createServerClient } from "@/lib/supabase/server";

export type CrossModulePulse = {
  leads: number;
  proposals: number;
  projects: number;
  overdueInvoices: number;
};

/** A compact business pulse used by the cross-module command surface. */
export async function getCrossModulePulse(): Promise<CrossModulePulse> {
  const supabase = await createServerClient();
  const [leads, proposals, projects, overdueInvoices] = await Promise.all([
    notDeleted(supabase.from("leads").select("id", { count: "exact", head: true })).in("status", [
      "new",
      "contacted",
      "in_conversation",
      "qualifying",
      "quoted",
    ]),
    notDeleted(supabase.from("proposals").select("id", { count: "exact", head: true })).in(
      "status",
      ["sent", "viewed"],
    ),
    notDeleted(supabase.from("projects").select("id", { count: "exact", head: true })).eq(
      "status",
      "active",
    ),
    notDeleted(supabase.from("invoices").select("id", { count: "exact", head: true })).eq(
      "status",
      "overdue",
    ),
  ]);

  return {
    leads: leads.count ?? 0,
    proposals: proposals.count ?? 0,
    projects: projects.count ?? 0,
    overdueInvoices: overdueInvoices.count ?? 0,
  };
}
