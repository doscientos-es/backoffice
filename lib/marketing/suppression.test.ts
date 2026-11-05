import { describe, expect, it, vi } from 'vitest'

import { assertMarketingEmailAllowed } from './suppression'

function client(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn(async () => result)
  const ilike = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ ilike }))
  return { supabase: { from: vi.fn(() => ({ select })) } as never, ilike }
}

describe('protección de bajas comerciales', () => {
  it('permite contactos suscritos o sin registro', async () => {
    for (const data of [{ status: 'subscribed' }, null]) {
      const { supabase, ilike } = client({ data, error: null })
      await expect(
        assertMarketingEmailAllowed(supabase, ' Ana_1@Example.test '),
      ).resolves.toBeUndefined()
      expect(ilike).toHaveBeenCalledWith('email', 'ana\\_1@example.test')
    }
  })

  it.each(['unsubscribed', 'bounced', 'complained'])('bloquea %s', async (status) => {
    const { supabase } = client({ data: { status }, error: null })
    await expect(assertMarketingEmailAllowed(supabase, 'ana@example.test')).rejects.toThrow(
      'dado de baja',
    )
  })

  it('bloquea el envío si no puede consultar la baja', async () => {
    const { supabase } = client({ data: null, error: { message: 'failure' } })
    await expect(assertMarketingEmailAllowed(supabase, 'ana@example.test')).rejects.toThrow(
      'No se pudo comprobar',
    )
  })
})
