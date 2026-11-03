import { z } from 'zod'

export const HistoryItemSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  subject: z.string().nullable(),
  body: z.string().nullable(),
  summary: z.string().nullable(),
  created_at: z.string(),
  truncated: z.boolean(),
})

export const HistoryPageSchema = z.object({
  items: z.array(HistoryItemSchema),
  hasMore: z.boolean(),
  nextOffset: z.number().nullable(),
})

export const AssistantRequestSchema = z.object({
  lead_id: z.string().uuid(),
  message: z.string().trim().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(5000),
      }),
    )
    .max(6)
    .default([]),
})

export const AssistantSearchSchema = z.object({
  queries: z.array(z.string().trim().min(1).max(120)).max(3),
  from: z.string().datetime({ offset: true }).nullable(),
  to: z.string().datetime({ offset: true }).nullable(),
})

export const AssistantResultSchema = z.object({
  answer: z.string().min(1).max(5000),
  sourceIds: z.array(z.string().max(100)).max(8),
  draft: z
    .object({
      kind: z.enum(['email', 'proposal']),
      title: z.string().max(200),
      body: z.string().min(1).max(6000),
    })
    .nullable(),
})

export type AssistantSource = {
  id: string
  label: string
  href: string
  createdAt: string | null
  content: string
}

export type AssistantResponse = z.infer<typeof AssistantResultSchema> & {
  sources: Omit<AssistantSource, 'content'>[]
  coverage: string
}

export type HistoryItem = z.infer<typeof HistoryItemSchema>
