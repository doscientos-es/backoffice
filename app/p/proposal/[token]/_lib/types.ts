import type { BillingCycle } from '@/lib/finance'

export type ProposalItem = {
  id: string
  description: string
  quantity: number
  unit_price: number
  vat_rate: number
  subtotal: number
  billing_cycle: BillingCycle | null
  discount_percent?: number | null
  discount_reason?: string | null
}

export type ProposalSpec = {
  id: string
  title: string
  portal_token: string
}
