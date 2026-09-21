const INE_CPI_SERIES_URL =
  'https://servicios.ine.es/wstempus/js/ES/DATOS_SERIE/IPC290750?nult=1'

type IneObservation = {
  Valor?: unknown
}

type IneSeries = {
  Data?: IneObservation[]
}

/** Extracts the latest annual national general CPI variation from an INE payload. */
export function parseLatestCpiRate(payload: unknown): number | null {
  const series = (Array.isArray(payload) ? payload[0] : payload) as IneSeries | undefined
  const observation = series?.Data?.find((item) => typeof item.Valor === 'number')
  if (!observation || typeof observation.Valor !== 'number' || !Number.isFinite(observation.Valor)) {
    return null
  }
  return observation.Valor
}

export async function fetchLatestCpiRate(): Promise<number> {
  const response = await fetch(INE_CPI_SERIES_URL, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    throw new Error(`INE CPI request failed with HTTP ${response.status}`)
  }

  const rate = parseLatestCpiRate(await response.json())
  if (rate === null) throw new Error('INE CPI response did not contain a valid annual rate')
  return rate
}

export function madridCalendar(date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  return { year: value('year'), month: value('month'), day: value('day') }
}