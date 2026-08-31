import { describe, expect, it, vi } from 'vitest'

import { getGoogleLocalPostInsights } from './local-posts'

const request = vi.hoisted(() => vi.fn())

vi.mock('./client', () => ({
  googleBusinessLocationName: () => 'accounts/account-1/locations/location-1',
  googleBusinessRequest: request,
}))

describe('Google Business local post insights', () => {
  it('maps aggregated views and CTA actions', async () => {
    request.mockResolvedValueOnce({
      timeZone: 'Europe/Madrid',
      localPostMetrics: [
        {
          localPostName: 'accounts/account-1/locations/location-1/localPosts/post-1',
          metricValues: [
            { metric: 'LOCAL_POST_VIEWS_SEARCH', totalValue: { value: '125' } },
            { metric: 'LOCAL_POST_ACTIONS_CALL_TO_ACTION', totalValue: { value: '9' } },
          ],
        },
      ],
    })

    await expect(getGoogleLocalPostInsights('post-1')).resolves.toMatchObject({
      views: 125,
      actions: 9,
      timeZone: 'Europe/Madrid',
    })
    expect(request).toHaveBeenCalledWith(
      'accounts/account-1/locations/location-1/localPosts:reportInsights',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
