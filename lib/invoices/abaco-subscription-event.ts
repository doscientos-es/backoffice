import { z } from 'zod'

const recipient = z.object({
  legal_name: z.string().trim().min(1).max(160),
  tax_id: z.string().regex(/^[A-Z0-9]{9}$/),
  street: z.string().trim().min(1).max(250),
  postal_code: z.string().regex(/^\d{5}$/),
  city: z.string().trim().min(1).max(120),
  province: z.string().trim().min(1).max(120),
  email: z.string().email().max(254),
})

const payment = z
  .object({
    paymentId: z.string().uuid(),
    tenantId: z.string().uuid(),
    order: z.string().regex(/^\d{4}[A-Za-z0-9]{4,8}$/),
    paidAt: z.string().datetime({ offset: true }),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    plan: z.enum(['solo', 'team', 'business', 'scale', 'standard']),
    interval: z.enum(['month', 'year']),
    netCents: z.number().int().nonnegative().max(100_000_000),
    totalCents: z.number().int().nonnegative().max(121_000_000),
    vatPercent: z.literal(21),
    recipient,
    chargeType: z
      .enum(['ai_upgrade', 'plan_upgrade', 'workers_upgrade', 'procurement_upgrade', 'mcp_upgrade'])
      .optional(),
    referralDiscount: z
      .object({
        originalNetCents: z.number().int().positive().max(100_000_000),
        discountCents: z.number().int().positive().max(121_000_000),
      })
      .optional(),
  })
  .refine(
    (p) =>
      p.totalCents === p.netCents + Math.floor((p.netCents * p.vatPercent + 50) / 100) &&
      (p.referralDiscount
        ? p.referralDiscount.originalNetCents > p.netCents &&
          p.referralDiscount.discountCents ===
            p.referralDiscount.originalNetCents +
              Math.floor((p.referralDiscount.originalNetCents * p.vatPercent + 50) / 100) -
              p.totalCents
        : p.netCents > 0) &&
      Date.parse(p.endsAt) > Date.parse(p.startsAt),
    'El importe o periodo no coincide con el cobro',
  )

export const abacoSubscriptionEvent = z.discriminatedUnion('action', [
  z.object({ action: z.literal('prepare'), tenantId: z.string().uuid(), recipient }),
  z.object({ action: z.literal('issue'), payment }),
])

export type AbacoSubscriptionPayment = z.infer<typeof payment>
