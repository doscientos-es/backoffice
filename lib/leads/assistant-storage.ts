import { z } from 'zod'

import { AssistantResultSchema } from './assistant-contract'

export const ASSISTANT_STORAGE_PREFIX = 'backoffice:lead-assistant:v1:'
export const ASSISTANT_HISTORY_TTL = 7 * 24 * 60 * 60 * 1000
export const ASSISTANT_MESSAGE_LIMIT = 50
const CONVERSATION_LIMIT = 20
const CHARACTER_LIMIT = 200_000

// Only the displayed response is cached, never retrieved source content or credentials.
const ResponseSchema = AssistantResultSchema.extend({
  draft: AssistantResultSchema.shape.draft
    .unwrap()
    .extend({ body: z.string().max(6000) })
    .nullable(),
  sources: z
    .array(
      z.object({
        id: z.string().max(100),
        label: z.string().max(500),
        href: z
          .string()
          .max(500)
          .refine(
            (href) =>
              href.startsWith('/') &&
              !href.startsWith('//') &&
              !href.includes('\\') &&
              Array.from(href).every((character) => character.charCodeAt(0) >= 32),
          ),
        createdAt: z.string().datetime({ offset: true }).nullable(),
      }),
    )
    .max(8),
  coverage: z.string().max(2000),
})

const MessageSchema = z.discriminatedUnion('role', [
  z.object({
    id: z.number().int().positive().safe(),
    role: z.literal('user'),
    content: z.string().min(1).max(2000),
  }),
  z.object({
    id: z.number().int().positive().safe(),
    role: z.literal('assistant'),
    content: z.string().min(1).max(5000),
    result: ResponseSchema,
  }),
])

const StoredConversationSchema = z.object({
  version: z.literal(1),
  userId: z.string().min(1),
  leadId: z.string().min(1),
  permissions: z.string().min(1),
  updatedAt: z.number().int().nonnegative(),
  messages: z.array(MessageSchema).max(ASSISTANT_MESSAGE_LIMIT),
  question: z.string().max(2000),
})

export type AssistantMessage = z.infer<typeof MessageSchema>
export type AssistantConversation = { messages: AssistantMessage[]; question: string }
export type AssistantStorageScope = { userId: string; permissions: string }

export function assistantStorageKey(scope: AssistantStorageScope, leadId: string): string {
  return `${ASSISTANT_STORAGE_PREFIX}${encodeURIComponent(scope.userId)}:${encodeURIComponent(leadId)}`
}

function parseConversation(raw: string | null, scope: AssistantStorageScope, now: number) {
  if (!raw || raw.length > CHARACTER_LIMIT) return null
  const parsed = StoredConversationSchema.safeParse(JSON.parse(raw))
  if (!parsed.success) return null
  const value = parsed.data
  if (
    value.userId !== scope.userId ||
    value.permissions !== scope.permissions ||
    value.updatedAt > now ||
    now - value.updatedAt >= ASSISTANT_HISTORY_TTL
  )
    return null
  if (new Set(value.messages.map((message) => message.id)).size !== value.messages.length)
    return null
  return value
}

export function readAssistantConversation(
  scope: AssistantStorageScope,
  leadId: string,
  now = Date.now(),
): (AssistantConversation & { updatedAt: number }) | null {
  const key = assistantStorageKey(scope, leadId)
  try {
    const value = parseConversation(window.localStorage.getItem(key), scope, now)
    if (value?.leadId === leadId)
      return { messages: value.messages, question: value.question, updatedAt: value.updatedAt }
    window.localStorage.removeItem(key)
  } catch {
    // Corrupt JSON and unavailable storage must not prevent an in-memory conversation.
    try {
      window.localStorage.removeItem(key)
    } catch {
      /* Storage is unavailable. */
    }
  }
  return null
}

export function removeAssistantConversation(scope: AssistantStorageScope, leadId: string): boolean {
  try {
    window.localStorage.removeItem(assistantStorageKey(scope, leadId))
    return true
  } catch {
    return false
  }
}

function assistantKeys(storage: Storage): string[] {
  return Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
    (key): key is string => key?.startsWith(ASSISTANT_STORAGE_PREFIX) === true,
  )
}

/** Purge expired, corrupt, other-user and old-permission records without touching other storage. */
export function pruneAssistantConversations(scope: AssistantStorageScope, now = Date.now()): void {
  try {
    const storage = window.localStorage
    const valid: { key: string; updatedAt: number }[] = []
    for (const key of assistantKeys(storage)) {
      try {
        const value = parseConversation(storage.getItem(key), scope, now)
        if (value && key === assistantStorageKey(scope, value.leadId)) {
          valid.push({ key, updatedAt: value.updatedAt })
        } else storage.removeItem(key)
      } catch {
        storage.removeItem(key)
      }
    }
    valid.sort((a, b) => b.updatedAt - a.updatedAt)
    for (const { key } of valid.slice(CONVERSATION_LIMIT)) storage.removeItem(key)
  } catch {
    /* Private browsing or disabled storage: keep working in memory. */
  }
}

export function saveAssistantConversation(
  scope: AssistantStorageScope,
  leadId: string,
  conversation: AssistantConversation,
  now = Date.now(),
): boolean {
  if (!conversation.messages.length && !conversation.question) {
    return removeAssistantConversation(scope, leadId)
  }
  try {
    const value = {
      version: 1,
      ...scope,
      leadId,
      updatedAt: now,
      messages: conversation.messages.slice(-ASSISTANT_MESSAGE_LIMIT),
      question: conversation.question.slice(0, 2000),
    }
    const parsed = StoredConversationSchema.safeParse(value)
    if (!parsed.success) return false
    let serialized = JSON.stringify(parsed.data)
    while (serialized.length > CHARACTER_LIMIT && parsed.data.messages.length) {
      parsed.data.messages.shift()
      serialized = JSON.stringify(parsed.data)
    }
    const storage = window.localStorage
    const key = assistantStorageKey(scope, leadId)
    const isNew = storage.getItem(key) === null
    storage.setItem(key, serialized)
    if (isNew) pruneAssistantConversations(scope, now)
    return true
  } catch {
    return false
  }
}

export function clearAssistantConversations(): void {
  try {
    const storage = window.localStorage
    for (const key of assistantKeys(storage)) storage.removeItem(key)
  } catch {
    /* Never block sign-out when browser storage is unavailable. */
  }
}
