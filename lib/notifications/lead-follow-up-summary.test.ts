import { describe, expect, it } from "vitest";
import type { FollowUps } from "@/lib/integrations/follow-ups";
import { collectLeadFollowUpSummaries, formatLeadFollowUpSummary } from "./lead-follow-up-summary";

const base: FollowUps = {
  generatedAt: "2026-08-22T10:00:00.000Z",
  thresholds: { leadHours: 24, proposalHours: 72, slaHours: 4 },
  counts: { staleLeads: 0, pendingProposals: 0, uncontactedLeads: 0 },
  staleLeads: [],
  uncontactedLeads: [],
  pendingProposals: [],
};

describe("lead follow-up summaries", () => {
  it("groups each lead once per recipient and escalates at-risk leads to admins", () => {
    const summaries = collectLeadFollowUpSummaries(
      {
        ...base,
        staleLeads: [
          {
            id: "lead-1",
            name: "Lead 1",
            company: null,
            phone: null,
            email: null,
            status: "new",
            statusLabel: "Nuevo",
            assignedTo: "member-1",
            since: "2026-08-19T10:00:00.000Z",
            hoursSince: 72,
            url: "/leads/lead-1",
          },
        ],
        uncontactedLeads: [
          {
            id: "lead-1",
            name: "Lead 1",
            company: null,
            phone: null,
            email: null,
            source: null,
            assignedTo: "member-1",
            createdAt: "2026-08-19T10:00:00.000Z",
            hoursUncontacted: 72,
            url: "/leads/lead-1",
          },
        ],
      },
      ["admin-1"],
    );

    expect(summaries).toEqual([
      {
        recipientId: "admin-1",
        pendingLeads: 1,
        uncontactedLeads: 1,
        staleLeads: 0,
        atRiskLeads: 1,
      },
      {
        recipientId: "member-1",
        pendingLeads: 1,
        uncontactedLeads: 1,
        staleLeads: 0,
        atRiskLeads: 1,
      },
    ]);
    expect(formatLeadFollowUpSummary(summaries[1]!)).toBe(
      "Tienes 1 lead pendiente: 1 sin primer contacto. 1 está en riesgo.",
    );
  });
});
