/**
 * Etiquetas humanas para los eventos de atribución que la landing registra
 * (ver landing/src/shared/lib/attribution.ts). Compartidas entre la página de
 * detalle del lead y el listado de eventos de marketing para que ambas vistas
 * hablen el mismo idioma. Nombres antiguos (whatsapp_cta_click,
 * contact_cta_click) pueden seguir apareciendo en leads históricos y se
 * muestran con su nombre crudo.
 */
export const CONVERSION_EVENT_LABEL: Record<string, string> = {
  page_view: "Vio una página",
  cta_click: "Clic en un CTA",
  calculator_used: "Usó la calculadora",
  form_started: "Empezó el formulario",
  whatsapp_click: "Clic en WhatsApp",
  form_submit: "Envió el formulario",
  lead_created: "Lead creado",
  diagnostic_started: "Diagnóstico iniciado",
  diagnostic_completed: "Diagnóstico completado",
  diagnostic_report_sent: "Diagnóstico enviado",
  diagnostic_report_opened: "Diagnóstico abierto",
};

/** Dónde/cómo ocurrió la conversión (ver inferConversionStep en la landing). */
export const CONVERSION_STEP_LABEL: Record<string, string> = {
  whatsapp_contact: "Contacto por WhatsApp",
  whatsapp_footer: "WhatsApp desde el pie",
  whatsapp_click: "Contacto por WhatsApp",
  diagnostic_form: "Formulario de diagnóstico",
  contact_form: "Formulario de contacto",
  landing_form: "Formulario de landing",
  blog_cta: "CTA del blog",
  resource_cta: "CTA de recurso",
  calculator: "Calculadora",
  pack_cta: "CTA de packs",
};

export function eventLabel(name: string): string {
  return CONVERSION_EVENT_LABEL[name] ?? name;
}

export function stepLabel(step: string): string {
  return CONVERSION_STEP_LABEL[step] ?? step;
}
