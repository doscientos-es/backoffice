import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  serverEnv: () => ({ REDSYS_SECRET_KEY: 'sq7HjrUOBfKmC576ILgskD5srU870gJ7' }),
}))

import { createRedsysPayment, verifyRedsysSignature } from './redsys'

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
})
