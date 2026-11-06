import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ send: vi.fn(), key: 'fake-test-key' }))

vi.mock('@/lib/email/resend', () => ({ sendEmail: state.send }))
vi.mock('@/lib/env', () => ({
  serverEnv: () => ({
    EMAIL_MARKETING_RESEND_API_KEY: state.key,
    RESEND_API_KEY: '',
    EMAIL_MARKETING_FROM_NAME: 'Equipo',
    EMAIL_MARKETING_FROM_EMAIL: 'hello@example.test',
    EMAIL_MARKETING_REPLY_TO: 'reply@example.test',
  }),
}))
vi.mock('./privacy-url', () => ({ MARKETING_PRIVACY_URL: 'https://example.test/privacy' }))

import { sendMarketingTest } from './send-test'

const message = {
  subject: 'Hola {{nombre}}',
  previewText: 'Para {{email}}',
  bodyMarkdown: '**{{nombre}}** de {{empresa}}. [Enlace](https://example.test/oferta)',
}
const user = { name: 'Ana <Admin>', email: 'ana@example.test' }

beforeEach(() => {
  state.key = 'fake-test-key'
  state.send.mockReset().mockResolvedValue({ id: 'test-id', mocked: false })
})

describe('envío de prueba de marketing', () => {
  it('usa el remitente real y renderiza el mensaje sin seguimiento ni baja real', async () => {
    await sendMarketingTest(message, user)
    const sent = state.send.mock.calls[0]![0]
    expect(sent).toMatchObject({
      to: user.email,
      fromName: 'Equipo',
      fromAlias: 'hello@example.test',
      replyTo: 'reply@example.test',
      apiKey: 'fake-test-key',
      subject: '[Prueba] Hola Ana <Admin>',
      tags: { email_marketing_test: 'true' },
    })
    expect(sent.html).toContain('<strong>Ana &lt;Admin&gt;</strong> de Empresa de ejemplo')
    expect(sent.html).toContain('Para ana@example.test')
    expect(sent.html).toContain('href="https://example.test/oferta"')
    expect(sent.html).toContain('href="#baja-de-prueba"')
    expect(sent.html).toContain('https://example.test/privacy')
    expect(sent.html).not.toContain('/api/track/')
    expect(sent.headers).toBeUndefined()
  })

  it('no presenta como enviada una prueba simulada o sin configuración', async () => {
    state.send.mockResolvedValueOnce({ id: null, mocked: true })
    await expect(sendMarketingTest(message, user)).rejects.toThrow()
    state.key = ''
    await expect(sendMarketingTest(message, user)).rejects.toThrow('configurado')
    expect(state.send).toHaveBeenCalledTimes(1)
  })
})
