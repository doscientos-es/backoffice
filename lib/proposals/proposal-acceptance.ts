import { createHash } from 'node:crypto'

export const PROPOSAL_ACCEPTANCE_VERSION = 'doscientos-proposal-acceptance-v2'

export const DEFAULT_PROPOSAL_LEGAL_TERMS = `1. **Contrato y alcance.** La aceptación electrónica de esta propuesta, junto con sus anexos y condiciones particulares, formaliza el encargo entre Doscientos y el Cliente. Solo están incluidos los trabajos y entregables descritos expresamente; cualquier cambio requerirá una aceptación previa por escrito y, en su caso, presupuesto adicional.

2. **Precio, facturación y vencimientos.** Los importes, impuestos y calendario de pago son los indicados en esta propuesta. El Cliente abonará cada plazo en la fecha o al cumplirse el hito previsto. Si un plazo no tuviera fecha concreta, vencerá a los 30 días naturales de la recepción de la factura, salvo que una norma imperativa establezca otro cómputo. Entre empresas, ningún aplazamiento podrá superar el máximo legal aplicable.

3. **Mora, suspensión y resolución.** Desde el día siguiente al vencimiento, los importes impagados devengarán los intereses de demora y la compensación por costes de cobro previstos por la normativa aplicable; en operaciones comerciales, se aplicará la Ley 3/2004. Doscientos podrá, previo aviso escrito, suspender los trabajos, accesos, soporte y entregas mientras haya importes vencidos; los plazos se ampliarán en la misma medida. Si el impago persiste tras un requerimiento escrito que conceda un plazo razonable de subsanación, Doscientos podrá resolver el encargo y exigir los importes vencidos, el trabajo realizado y los compromisos no cancelables asumidos frente a terceros.

4. **Entrega y validación.** Doscientos comunicará la disponibilidad de cada entregable. El Cliente profesional deberá revisarlo frente a los criterios de aceptación pactados y comunicar por escrito, con detalle suficiente, las no conformidades verificables en un máximo de 10 días hábiles; dicho proceso no excederá de 30 días naturales. Las observaciones ajenas al alcance, los cambios de preferencia o la decisión de no utilizar el entregable no constituyen una no conformidad ni suspenden el pago. La puesta en producción o uso efectivo del entregable supondrá su aceptación. Los derechos imperativos de consumidores y usuarios no quedan limitados por esta cláusula.

5. **Cancelación por el Cliente.** El Cliente podrá solicitar la terminación anticipada por escrito. En ese caso se liquidarán el trabajo efectivamente realizado y documentado hasta la fecha, los gastos de terceros no cancelables y los costes razonables e inevitables de recursos ya reservados que no puedan reasignarse. Los importes ya pagados se imputarán a esa liquidación y se devolverá cualquier exceso que resulte a favor del Cliente. Tras una entrega conforme, la decisión posterior de no continuar, no publicar o no utilizar el trabajo no libera al Cliente del pago de los importes devengados.

6. **Propiedad intelectual.** Una vez abonado íntegramente el precio, Doscientos cede al Cliente los derechos de explotación necesarios sobre los desarrollos creados específicamente para este proyecto —reproducción, distribución, comunicación pública y transformación— para cualquier territorio y durante el máximo plazo legal. Quedan excluidos y seguirán siendo titularidad de Doscientos sus herramientas, bibliotecas, plantillas, componentes genéricos, metodologías, conocimientos previos y mejoras reutilizables, que Doscientos podrá usar y adaptar en otros proyectos, sin revelar información confidencial del Cliente. Los componentes de terceros se regirán por sus propias licencias.

7. **Colaboración.** El Cliente facilitará en plazo los accesos, contenidos, decisiones y validaciones necesarios. Los plazos podrán ajustarse de forma proporcional ante retrasos o dependencias imputables al Cliente o a terceros.

8. **Confidencialidad y datos.** Cada parte protegerá la información confidencial de la otra. Si Doscientos trata datos personales por cuenta del Cliente, las partes formalizarán, cuando sea exigible, el correspondiente acuerdo de encargo de tratamiento antes de dicho acceso.

9. **Caso de éxito.** Salvo pacto escrito distinto, el Cliente autoriza a Doscientos a describir la colaboración como caso de éxito y a mostrar los entregables ya hechos públicos, su denominación, marcas y logotipos, exclusivamente para acreditar su experiencia profesional. Doscientos no divulgará información confidencial, datos personales ni métricas no públicas, y atenderá las objeciones razonables y justificadas del Cliente cuando exista un riesgo legítimo para su seguridad, sus secretos empresariales o el cumplimiento normativo.

10. **Responsabilidad y ley aplicable.** Salvo norma imperativa aplicable, la responsabilidad total de Doscientos se limitará al importe efectivamente abonado por el Cliente por el servicio que origine la reclamación. Para relaciones entre empresas, las partes se someten a los juzgados y tribunales de Barcelona; si el Cliente actúa como consumidor, se aplicarán los fueros imperativos que correspondan.`

export const PROPOSAL_ACCEPTANCE_CONSENT =
  'Declaro que tengo capacidad suficiente para representar al Cliente y acepto íntegramente la propuesta, sus condiciones particulares y las condiciones generales de contratación.'

type ProposalAcceptanceSource = Record<string, unknown>

type ProposalAcceptanceItem = {
  id: string
  description: string
  quantity: number
  unit_price: number
  vat_rate: number
  subtotal: number
  billing_cycle: string | null
}

export function effectiveProposalTerms(terms: string | null, legalTerms?: string | null): string {
  const particularTerms = terms?.trim()
  const generalTerms = legalTerms?.trim() || DEFAULT_PROPOSAL_LEGAL_TERMS
  return particularTerms
    ? `${particularTerms}\n\n${generalTerms}`
    : generalTerms
}

/** Creates a deterministic, self-contained record of the document accepted by the client. */
export function proposalAcceptanceSnapshot(
  proposal: ProposalAcceptanceSource,
  items: ProposalAcceptanceItem[],
  fiscalData: unknown,
) {
  return {
    version: PROPOSAL_ACCEPTANCE_VERSION,
    proposal: {
      id: proposal.id ?? null,
      number: proposal.number ?? null,
      title: proposal.title ?? null,
      currency: proposal.currency ?? 'EUR',
      subtotal: proposal.subtotal ?? null,
      tax_amount: proposal.tax_amount ?? null,
      total: proposal.total ?? null,
      valid_until: proposal.valid_until ?? null,
      context_markdown: proposal.context_markdown ?? null,
      problems: proposal.problems ?? null,
      solutions: proposal.solutions ?? null,
      scope_modules: proposal.scope_modules ?? null,
      deliverables: proposal.deliverables ?? null,
      acceptance_criteria: proposal.acceptance_criteria ?? null,
      payment_schedule: proposal.payment_schedule ?? null,
      payment_plan: proposal.payment_plan ?? null,
      payment_terms: proposal.payment_terms ?? null,
      change_management_terms: proposal.change_management_terms ?? null,
      maintenance_options: proposal.maintenance_options ?? null,
      maintenance_selected_plan_id: proposal.maintenance_selected_plan_id ?? null,
      terms: proposal.terms ?? null,
      legal_terms:
        (proposal.legal_terms as string | null) ?? DEFAULT_PROPOSAL_LEGAL_TERMS,
      notes: proposal.notes ?? null,
      items,
    },
    fiscal_data: fiscalData ?? null,
  }
}

export function proposalAcceptanceHash(snapshot: unknown): string {
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
}