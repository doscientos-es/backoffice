type LeadContextRow = Record<string, unknown>;

function display(value: unknown): string {
  if (value == null || (typeof value === "string" && value.trim() === "")) return "—";
  return String(value);
}

function yesNoUnknown(value: unknown): string {
  return value === true ? "sí" : value === false ? "no" : "sin marcar";
}

function compact(values: unknown[]): string {
  return values.filter((value) => value != null && String(value).trim() !== "").join(" · ") || "—";
}

/** Serializes the CRM fields that influence qualification and sales prioritization. */
export function formatLeadContextForAI(lead: LeadContextRow): string {
  return [
    `Nombre: ${display(lead.name)}`,
    `Alias: ${display(lead.alias)}`,
    `Empresa: ${display(lead.company)}`,
    `Email: ${display(lead.email)}`,
    `Teléfono: ${display(lead.phone)}`,
    `Origen: ${display(lead.source)}`,
    `Estado: ${display(lead.status)}`,
    `Valor estimado: ${display(lead.estimated_value)}`,
    `Score: ${display(lead.score)}`,
    `Notas: ${display(lead.notes)}`,
    `Cualificación: empresa ${display(lead.company_size)} · solución ${display(lead.solution_type)} · urgencia ${display(lead.urgency)}`,
    `Mom Test: problema real ${yesNoUnknown(lead.mom_test_real_problem)} · consciente ${yesNoUnknown(lead.mom_test_aware_problem)} · soluciones previas ${yesNoUnknown(lead.mom_test_tried_solutions)} · decisión/presupuesto ${yesNoUnknown(lead.mom_test_decision_power_or_budget)} · accesible ${yesNoUnknown(lead.mom_test_accessible)}`,
    `Primer contacto: ${display(lead.first_contacted_at)}`,
    `Conversión: ${compact([lead.conversion_step, lead.landing_subject])}`,
    `Landing: ${compact([lead.landing_path, lead.landing_ref])}`,
    `Atribución inicial: ${compact([lead.first_landing_path, lead.first_referrer, lead.first_utm_source, lead.first_utm_medium, lead.first_utm_campaign, lead.first_utm_term, lead.first_utm_content])}`,
    `Atribución última: ${compact([lead.last_landing_path, lead.last_referrer, lead.last_utm_source, lead.last_utm_medium, lead.last_utm_campaign, lead.last_utm_term, lead.last_utm_content])}`,
    `Calculadora: ${compact([lead.calculator_cost, lead.calculator_hours])}`,
    `Pérdida/no interés: ${compact([lead.lost_reason, lead.lost_at])}`,
    `Resumen IA anterior: ${display(lead.ai_summary)}`,
    `Siguiente paso IA anterior: ${display(lead.ai_suggested_next_step)} · fecha: ${display(lead.ai_suggested_next_step_at)}`,
  ].join("\n");
}

export type ScheduledLeadTaskForAI = {
  title: string | null;
  description: string | null;
  start_at: string | null;
  status: string | null;
  priority: string | number | null;
};

export function formatScheduledLeadTasksForAI(tasks: ScheduledLeadTaskForAI[]): string {
  return tasks
    .map(
      (task) =>
        `- ${display(task.start_at)} | ${display(task.title)} | estado: ${display(task.status)} | prioridad: ${display(task.priority)}${task.description ? ` | ${task.description.slice(0, 400)}` : ""}`,
    )
    .join("\n");
}

export type LeadProposalForAI = {
  number: string | null;
  title: string | null;
  status: string | null;
  total: number | null;
  valid_until: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  notes: string | null;
};

export function formatLeadProposalsForAI(proposals: LeadProposalForAI[]): string {
  return proposals
    .map(
      (proposal) =>
        `- ${display(proposal.number)} | ${display(proposal.title)} | estado: ${display(proposal.status)} | total: ${display(proposal.total)} | válida hasta: ${display(proposal.valid_until)} | enviada: ${display(proposal.sent_at)} | vista: ${display(proposal.viewed_at)} | respondida: ${display(proposal.responded_at)}${proposal.notes ? ` | ${proposal.notes.slice(0, 500)}` : ""}`,
    )
    .join("\n");
}

export type LeadConversionEventForAI = {
  event_name: string;
  conversion_step: string | null;
  landing_path: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  created_at: string;
};

export function formatLeadConversionEventsForAI(events: LeadConversionEventForAI[]): string {
  return events
    .map(
      (event) =>
        `- ${display(event.created_at)} | ${display(event.event_name)} | paso: ${display(event.conversion_step)} | landing: ${display(event.landing_path)} | ref: ${display(event.referrer)} | UTM: ${compact([event.utm_source, event.utm_campaign])}`,
    )
    .join("\n");
}
