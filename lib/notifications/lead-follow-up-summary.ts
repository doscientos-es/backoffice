import type { FollowUps } from "@/lib/integrations/follow-ups";

const STALE_HOURS = 24;
const AT_RISK_HOURS = 72;

export type LeadFollowUpSummary = {
  recipientId: string;
  pendingLeads: number;
  uncontactedLeads: number;
  staleLeads: number;
  atRiskLeads: number;
};

type PendingLead = {
  assignedTo: string | null;
  uncontacted: boolean;
  atRisk: boolean;
};

export function collectLeadFollowUpSummaries(
  data: FollowUps,
  adminIds: string[],
): LeadFollowUpSummary[] {
  const leads = new Map<string, PendingLead>();
  for (const lead of data.staleLeads) {
    if (lead.hoursSince < STALE_HOURS) continue;
    leads.set(lead.id, {
      assignedTo: lead.assignedTo,
      uncontacted: false,
      atRisk: lead.hoursSince >= AT_RISK_HOURS,
    });
  }
  for (const lead of data.uncontactedLeads) {
    const existing = leads.get(lead.id);
    leads.set(lead.id, {
      assignedTo: lead.assignedTo ?? existing?.assignedTo ?? null,
      uncontacted: true,
      atRisk: existing?.atRisk ?? false,
    });
  }

  const summaries = new Map<string, LeadFollowUpSummary>();
  for (const lead of leads.values()) {
    const recipients =
      lead.atRisk || !lead.assignedTo
        ? [...new Set([...(lead.assignedTo ? [lead.assignedTo] : []), ...adminIds])]
        : [lead.assignedTo];
    for (const recipientId of recipients) {
      const summary = summaries.get(recipientId) ?? {
        recipientId,
        pendingLeads: 0,
        uncontactedLeads: 0,
        staleLeads: 0,
        atRiskLeads: 0,
      };
      summary.pendingLeads += 1;
      if (lead.uncontacted) summary.uncontactedLeads += 1;
      else summary.staleLeads += 1;
      if (lead.atRisk) summary.atRiskLeads += 1;
      summaries.set(recipientId, summary);
    }
  }
  return [...summaries.values()].sort((a, b) => a.recipientId.localeCompare(b.recipientId));
}

export function formatLeadFollowUpSummary(summary: LeadFollowUpSummary): string {
  const total = `${summary.pendingLeads} ${summary.pendingLeads === 1 ? "lead pendiente" : "leads pendientes"}`;
  const categories = [
    summary.uncontactedLeads && `${summary.uncontactedLeads} sin primer contacto`,
    summary.staleLeads && `${summary.staleLeads} sin seguimiento`,
  ].filter((item): item is string => Boolean(item));
  const risk = summary.atRiskLeads
    ? ` ${summary.atRiskLeads} ${summary.atRiskLeads === 1 ? "está" : "están"} en riesgo.`
    : "";
  return `Tienes ${total}: ${categories.join(" y ")}.${risk}`;
}
