import { describe, expect, it } from "vitest";
import {
  formatLeadContextForAI,
  formatLeadConversionEventsForAI,
  formatLeadProposalsForAI,
  formatScheduledLeadTasksForAI,
} from "./ai-context";

describe("lead AI context", () => {
  it("includes qualification, attribution and Mom Test signals", () => {
    const context = formatLeadContextForAI({
      name: "María",
      company: "Acme",
      solution_type: "Web app",
      urgency: "Esta semana",
      mom_test_real_problem: true,
      mom_test_decision_power_or_budget: false,
      landing_path: "/contacto",
      first_utm_campaign: "q3",
    });

    expect(context).toContain("Cualificación: empresa — · solución Web app · urgencia Esta semana");
    expect(context).toContain("Mom Test: problema real sí");
    expect(context).toContain("Atribución inicial: q3");
  });

  it("keeps scheduled tasks and proposal status actionable", () => {
    expect(
      formatScheduledLeadTasksForAI([
        {
          title: "Llamar para validar presupuesto",
          description: "Preguntar por disponibilidad esta semana.",
          start_at: "2026-07-15T10:00:00.000Z",
          status: "todo",
          priority: "high",
        },
      ]),
    ).toContain("Llamar para validar presupuesto");
    expect(
      formatLeadProposalsForAI([
        {
          number: "P-001",
          title: "Web corporativa",
          status: "viewed",
          total: 5000,
          valid_until: "2026-07-30",
          sent_at: "2026-07-14",
          viewed_at: "2026-07-14",
          responded_at: null,
          notes: null,
        },
      ]),
    ).toContain("estado: viewed");
    expect(
      formatLeadConversionEventsForAI([
        {
          event_name: "form_submit",
          conversion_step: "contact",
          landing_path: "/contacto",
          referrer: "google",
          utm_source: "google",
          utm_campaign: "brand",
          created_at: "2026-07-14T10:00:00.000Z",
        },
      ]),
    ).toContain("form_submit");
  });
});
