export const DEFAULT_HOURLY_RATE_EUR = 60
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

/** Tarifa/hora desde `AI_PRICING_HOURLY_RATE_EUR`; valores inválidos usan el defecto. */
export function resolveHourlyRate(raw = process.env.AI_PRICING_HOURLY_RATE_EUR): number {
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1000 ? parsed : DEFAULT_HOURLY_RATE_EUR
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
