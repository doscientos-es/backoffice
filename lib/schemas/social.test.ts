import { describe, expect, it } from 'vitest'

import { UpdateScheduledPostMediaInput } from './social'

const postId = '11111111-1111-1111-1111-111111111111'
const image = {
  storagePath: 'social/post.jpg',
  publicUrl: 'https://example.com/post.jpg',
  type: 'image',
  mime: 'image/jpeg',
} as const

describe('UpdateScheduledPostMediaInput', () => {
  it('accepts replacing a scheduled post image', () => {
    expect(UpdateScheduledPostMediaInput.safeParse({ postId, media: [image] }).success).toBe(true)
  })

  it('rejects an invalid post id and malformed media URL', () => {
    expect(
      UpdateScheduledPostMediaInput.safeParse({
        postId: 'not-a-uuid',
        media: [{ ...image, publicUrl: 'not-a-url' }],
      }).success,
    ).toBe(false)
  })
})
