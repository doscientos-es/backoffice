import { describe, expect, it, vi } from 'vitest'

const { env } = vi.hoisted(() => ({
  env: { REDSYS_SECRET_KEY: Buffer.alloc(24, 42).toString('base64') },
}))

vi.mock('@/lib/env', () => ({
  serverEnv: () => env,
}))

import { assertRedsysConfigured, createRedsysPayment, verifyRedsysSignature } from './redsys'

describe('Redsys configuration', () => {
  it('requires an explicitly configured 24-byte Base64 merchant key', () => {
    env.REDSYS_SECRET_KEY = ''
    expect(() => assertRedsysConfigured()).toThrow('falta REDSYS_SECRET_KEY')

    env.REDSYS_SECRET_KEY = Buffer.alloc(23, 42).toString('base64')
    expect(() => assertRedsysConfigured()).toThrow('no es válida')

    env.REDSYS_SECRET_KEY = Buffer.alloc(24, 42).toString('base64')
    expect(() => assertRedsysConfigured()).not.toThrow()
  })
})

describe('createRedsysPayment', () => {
  it('keeps Base64 padding in the parameters and SHA-256 signature', () => {
    const params = {
      Ds_Merchant_Amount: '249',
      Ds_Merchant_Order: '1234567890',
      Ds_Merchant_MerchantCode: '999008881',
      Ds_Merchant_Terminal: '1',
      Ds_Merchant_Currency: '978',
      Ds_Merchant_TransactionType: '0',
      Ds_Merchant_MerchantURL: 'https://example.test/redsys',
      Ds_Merchant_UrlOK: 'https://example.test/ok',
      Ds_Merchant_UrlKO: 'https://example.test/ko',
    }

    const payment = createRedsysPayment(params)

    expect(payment.Ds_MerchantParameters).toMatch(/=$/)
    expect(payment.Ds_Signature).toMatch(/=$/)
    expect(JSON.parse(Buffer.from(payment.Ds_MerchantParameters, 'base64').toString())).toEqual(
      params,
    )
    expect(verifyRedsysSignature(payment.Ds_MerchantParameters, payment.Ds_Signature)).toBe(true)
  })

  it('rejects malformed notification payloads without throwing', () => {
    expect(verifyRedsysSignature('not-json', 'signature')).toBe(false)
  })
})
