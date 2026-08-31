import { describe, expect, it, vi } from 'vitest'

import { PublishError } from '@/lib/social/core'

import { fetchGoogleBusinessPerformance } from './performance'

const request = vi.hoisted(() => vi.fn())

vi.mock('./client', () => ({
  googleBusinessLocationId: () => 'location-1',
  googleBusinessPerformanceRequest: request,
}))

describe('Google Business performance metrics', () => {
  it('maps dated metric values and ignores malformed points', async () => {
    request.mockImplementation(async (path: string) =>
      path.includes('CALL_CLICKS')
        ? {
            timeSeries: {
              datedValues: [
                { date: { year: 2026, month: 7, day: 23 }, value: '12' },
                { date: { year: 2026, month: 7 }, value: '4' },
              ],
            },
          }
        : { timeSeries: { datedValues: [] } },
    )

    const metrics = await fetchGoogleBusinessPerformance(1)
    expect(metrics).toContainEqual({
      metric: 'CALL_CLICKS',
      date: '2026-07-23',
      value: 12,
    })
    expect(metrics).toHaveLength(1)
  })

  it('throws instead of returning an empty list when every metric request fails', async () => {
    request.mockRejectedValue(
      new PublishError('google_business_profile', 'Google Business Profile 403: API no habilitada'),
    )

    await expect(fetchGoogleBusinessPerformance(1)).rejects.toThrow(
      /No se pudieron obtener las métricas de Google Business Profile/,
    )
  })

  it('tolerates partial failures and still returns the metrics that succeeded', async () => {
    request.mockImplementation(async (path: string) =>
      path.includes('CALL_CLICKS')
        ? {
            timeSeries: {
              datedValues: [{ date: { year: 2026, month: 7, day: 23 }, value: '5' }],
            },
          }
        : Promise.reject(
            new PublishError('google_business_profile', 'Google Business Profile 403'),
          ),
    )

    const metrics = await fetchGoogleBusinessPerformance(1)
    expect(metrics).toEqual([{ metric: 'CALL_CLICKS', date: '2026-07-23', value: 5 }])
  })
})
