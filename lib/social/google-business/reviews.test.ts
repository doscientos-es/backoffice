import { describe, expect, it, vi } from 'vitest'

import { listGoogleBusinessReviews, replyToGoogleBusinessReview } from './reviews'

const request = vi.hoisted(() => vi.fn())

vi.mock('./client', () => ({
  googleBusinessLocationName: () => 'accounts/account-1/locations/location-1',
  googleBusinessRequest: request,
}))

describe('Google Business reviews', () => {
  it('fetches all review pages', async () => {
    request
      .mockResolvedValueOnce({
        reviews: [{ name: 'accounts/a/locations/l/reviews/1' }],
        averageRating: 4.5,
        totalReviewCount: 2,
        nextPageToken: 'next',
      })
      .mockResolvedValueOnce({
        reviews: [{ name: 'accounts/a/locations/l/reviews/2' }],
      })

    await expect(listGoogleBusinessReviews()).resolves.toMatchObject({
      reviews: [
        { name: 'accounts/a/locations/l/reviews/1' },
        { name: 'accounts/a/locations/l/reviews/2' },
      ],
      averageRating: 4.5,
      totalReviewCount: 2,
    })
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('sends a public reply to the review resource', async () => {
    request.mockResolvedValueOnce({})
    await replyToGoogleBusinessReview('accounts/a/locations/l/reviews/1', 'Gracias por tu reseña')
    expect(request).toHaveBeenCalledWith('accounts/a/locations/l/reviews/1/reply', {
      method: 'PUT',
      body: JSON.stringify({ comment: 'Gracias por tu reseña' }),
    })
  })
})
