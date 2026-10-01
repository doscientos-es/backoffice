import { describe, expect, it } from 'vitest'

import { PublicSchema, ServerSchema, VaultEncryptionKeySchema } from './env.schema'

describe('ServerSchema', () => {
  it('does not provide a Redsys merchant secret by default', () => {
    const result = ServerSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-12345678901234567890',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-12345678901234567890',
    })

    expect(result.REDSYS_SECRET_KEY).toBe('')
  })
})

describe('PublicSchema', () => {
  it('keeps the public environment schema usable without optional integrations', () => {
    expect(
      PublicSchema.parse({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-12345678901234567890',
      }),
    ).toMatchObject({ NEXT_PUBLIC_CAL_LINK: '' })
  })
})

describe('VaultEncryptionKeySchema', () => {
  it('accepts an empty local-development fallback', () => {
    expect(VaultEncryptionKeySchema.safeParse('').success).toBe(true)
  })

  it('accepts a canonical 32-byte Base64 key', () => {
    const key = Buffer.alloc(32, 42).toString('base64')
    expect(VaultEncryptionKeySchema.safeParse(key).success).toBe(true)
  })

  it('rejects malformed or incorrectly sized keys', () => {
    expect(VaultEncryptionKeySchema.safeParse('not-base64').success).toBe(false)
    expect(VaultEncryptionKeySchema.safeParse(Buffer.alloc(31).toString('base64')).success).toBe(
      false,
    )
  })
})
