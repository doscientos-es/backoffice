import { beforeEach, describe, expect, it, vi } from 'vitest'

import { markPublishing, updateScheduledPostMedia } from './posts'

const state = vi.hoisted(() => ({
  client: { from: vi.fn() },
  result: { data: { id: 'post-1' } as { id: string } | null, error: null as unknown },
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => state.client),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

const media = [
  {
    storagePath: 'social/new-image.jpg',
    publicUrl: 'https://example.com/new-image.jpg',
    type: 'image' as const,
    mime: 'image/jpeg',
  },
]

describe('updateScheduledPostMedia', () => {
  const builder = {
    update: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    is: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    state.result = { data: { id: 'post-1' }, error: null }
    builder.update.mockReturnValue(builder)
    builder.eq.mockReturnValue(builder)
    builder.in.mockReturnValue(builder)
    builder.is.mockReturnValue(builder)
    builder.select.mockReturnValue(builder)
    builder.maybeSingle.mockImplementation(async () => state.result)
    state.client.from.mockReturnValue(builder)
  })

  it('updates media only when the post is still scheduled and unpublished', async () => {
    await expect(updateScheduledPostMedia('post-1', media)).resolves.toBeUndefined()

    expect(state.client.from).toHaveBeenCalledWith('social_posts')
    expect(builder.update).toHaveBeenCalledWith({ media, media_kind: 'photo' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'post-1')
    expect(builder.eq).toHaveBeenCalledWith('status', 'scheduled')
    expect(builder.is).toHaveBeenCalledWith('published_at', null)
  })

  it('rejects when the post is no longer scheduled', async () => {
    state.result = { data: null, error: null }

    await expect(updateScheduledPostMedia('post-1', media)).rejects.toThrow(
      'La publicación ya no está programada',
    )
  })

  it('does not claim a post that is already publishing or published', async () => {
    state.result = { data: null, error: null }

    await expect(markPublishing('post-1')).resolves.toBe(false)

    expect(builder.in).toHaveBeenCalledWith('status', [
      'draft',
      'scheduled',
      'failed',
      'partially_failed',
    ])
    expect(state.client.from).toHaveBeenCalledTimes(1)
  })
})
