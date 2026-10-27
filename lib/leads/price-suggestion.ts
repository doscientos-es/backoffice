const ROUNDING_STEP_EUR = 50

export type PriceSuggestionItem = {
  name: string
  hours_min: number
  hours_max: number
  price_min: number
  price_max: number
}

export type PriceSuggestion = {
  scope_summary: string
  items: PriceSuggestionItem[]
  hourly_rate: number
  /** IVA por defecto de la empresa (%), para las líneas de la propuesta. */
  vat_rate: number
  hours_min: number
  hours_max: number
  /** Euros, redondeados a múltiplos de 50. */
  min: number
  recommended: number
  max: number
  assumptions: string[]
  missing_info: string[]
  confidence: number
}

type PriceSuggestionInput = {
  scope_summary: string
  items: Array<{ name: string; hours_min: number; hours_max: number }>
  assumptions: string[]
  missing_info: string[]
  confidence: number
}

/** Tarifa de venta (Ajustes › Empresa). `null` si no está configurada o no es válida. */
export function parseHourlyRate(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1000 ? parsed : null
}

export type ProposalDraftLine = {
  description: string
  quantity: number
  unit_price: number
  vat_rate: number
  billing_cycle: 'none'
  discount_percent: number
}

/**
 * Una línea de propuesta por partida, al punto medio de su rango. Así el
 * total del borrador queda alineado con el precio recomendado.
 */
export function toProposalLines(suggestion: PriceSuggestion, vatRate: number): ProposalDraftLine[] {
  return suggestion.items.map((item) => ({
    description: item.name,
    quantity: 1,
    unit_price: roundToStep((item.price_min + item.price_max) / 2),
    vat_rate: vatRate,
    billing_cycle: 'none',
    discount_percent: 0,
  }))
}

function roundToStep(value: number): number {
  return Math.round(value / ROUNDING_STEP_EUR) * ROUNDING_STEP_EUR
}

/**
 * Convierte las horas estimadas por la IA en euros. Los euros se calculan en
 * código (no los inventa el modelo) para que el desglose sea consistente.
 */
export function buildPriceSuggestion(
  input: PriceSuggestionInput,
  hourlyRate: number,
  vatRate = 21,
): PriceSuggestion {
  const items = input.items.map((item) => {
    const low = Math.min(item.hours_min, item.hours_max)
    const high = Math.max(item.hours_min, item.hours_max)
    return {
      name: item.name,
      hours_min: low,
      hours_max: high,
      price_min: roundToStep(low * hourlyRate),
      price_max: roundToStep(high * hourlyRate),
    }
  })
  const hoursMin = items.reduce((sum, item) => sum + item.hours_min, 0)
  const hoursMax = items.reduce((sum, item) => sum + item.hours_max, 0)
  const min = roundToStep(hoursMin * hourlyRate)
  const max = roundToStep(hoursMax * hourlyRate)
  return {
    scope_summary: input.scope_summary,
    items,
    hourly_rate: hourlyRate,
    vat_rate: vatRate,
    hours_min: hoursMin,
    hours_max: hoursMax,
    min,
    recommended: roundToStep((min + max) / 2),
    max,
    assumptions: input.assumptions,
    missing_info: input.missing_info,
    confidence: input.confidence,
  }
}
