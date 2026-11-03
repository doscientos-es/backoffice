import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ASSISTANT_HISTORY_TTL,
  ASSISTANT_STORAGE_PREFIX,
  assistantStorageKey,
  clearAssistantConversations,
  pruneAssistantConversations,
  readAssistantConversation,
  saveAssistantConversation,
  type AssistantMessage,
} from './assistant-storage'

const SCOPE = { userId: 'synthetic-user', permissions: 'member:all:true:false' }
const NOW = Date.parse('2026-01-10T12:00:00Z')
const CONVERSATION = { messages: [], question: 'Pregunta sintética' }

describe('assistant local storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('restores messages and an unfinished question only for the same user, lead and permissions', () => {
    expect(saveAssistantConversation(SCOPE, 'lead-one', CONVERSATION, NOW)).toBe(true)
    expect(readAssistantConversation(SCOPE, 'lead-one', NOW)).toEqual({
      ...CONVERSATION,
      updatedAt: NOW,
    })
    expect(readAssistantConversation(SCOPE, 'lead-two', NOW)).toBeNull()
    expect(
      readAssistantConversation({ ...SCOPE, userId: 'other-user' }, 'lead-one', NOW),
    ).toBeNull()
    expect(
      readAssistantConversation(
        { ...SCOPE, permissions: 'viewer:assigned:false:false' },
        'lead-one',
        NOW,
      ),
    ).toBeNull()
    expect(readAssistantConversation(SCOPE, 'lead-one', NOW)).toBeNull()
  })

  it('expires after seven days without extending expiry when the history is read', () => {
    saveAssistantConversation(SCOPE, 'lead', CONVERSATION, NOW)
    expect(readAssistantConversation(SCOPE, 'lead', NOW + ASSISTANT_HISTORY_TTL - 1)).not.toBeNull()
    expect(readAssistantConversation(SCOPE, 'lead', NOW + ASSISTANT_HISTORY_TTL)).toBeNull()
    expect(localStorage.getItem(assistantStorageKey(SCOPE, 'lead'))).toBeNull()
  })

  it.each([
    'invalid JSON',
    JSON.stringify({ version: 99 }),
    JSON.stringify({
      version: 1,
      ...SCOPE,
      leadId: 'lead',
      updatedAt: NOW,
      messages: 'invalid',
      question: '',
    }),
  ])('removes malformed or unsupported history without throwing', (raw) => {
    const key = assistantStorageKey(SCOPE, 'lead')
    localStorage.setItem(key, raw)
    expect(readAssistantConversation(SCOPE, 'lead', NOW)).toBeNull()
    expect(localStorage.getItem(key)).toBeNull()
  })

  it('bounds saved messages, stored size and the number of leads', () => {
    const messages: AssistantMessage[] = Array.from({ length: 60 }, (_, index) => ({
      id: index + 1,
      role: 'user',
      content: `Pregunta ${index + 1}`,
    }))
    saveAssistantConversation(SCOPE, 'lead', { messages, question: '' }, NOW)
    const restored = readAssistantConversation(SCOPE, 'lead', NOW)!
    expect(restored.messages).toHaveLength(50)
    expect(restored.messages[0]!.id).toBe(11)

    const longMessages: AssistantMessage[] = Array.from({ length: 50 }, (_, index) => ({
      id: index + 1,
      role: 'assistant',
      content: 'A'.repeat(5000),
      result: {
        answer: 'A'.repeat(5000),
        sourceIds: [],
        sources: [],
        coverage: 'Partial',
        draft: null,
      },
    }))
    saveAssistantConversation(SCOPE, 'large-lead', { messages: longMessages, question: '' }, NOW)
    expect(
      localStorage.getItem(assistantStorageKey(SCOPE, 'large-lead'))!.length,
    ).toBeLessThanOrEqual(200_000)
    expect(readAssistantConversation(SCOPE, 'large-lead', NOW)!.messages.at(-1)!.id).toBe(50)

    for (let index = 0; index < 21; index++) {
      saveAssistantConversation(SCOPE, `lead-${index}`, CONVERSATION, NOW + index + 1)
    }
    expect(localStorage.length).toBe(20)
    expect(readAssistantConversation(SCOPE, 'lead-0', NOW + 30)).toBeNull()
    expect(readAssistantConversation(SCOPE, 'lead-20', NOW + 30)).not.toBeNull()
  })

  it('rejects unsafe source links and retains an empty edited draft', () => {
    const message: AssistantMessage = {
      id: 1,
      role: 'assistant',
      content: 'Respuesta sintética',
      result: {
        answer: 'Respuesta sintética',
        sourceIds: [],
        coverage: 'Partial',
        draft: { kind: 'email', title: '', body: '' },
        sources: [
          { id: 'lead:synthetic', label: 'Ficha', href: '/leads/synthetic', createdAt: null },
        ],
      },
    }
    expect(
      saveAssistantConversation(SCOPE, 'lead', { messages: [message], question: '' }, NOW),
    ).toBe(true)
    expect(readAssistantConversation(SCOPE, 'lead', NOW)!.messages[0]).toEqual(message)
    for (const href of ['javascript:alert(1)', '//outside.invalid', '/\\outside.invalid']) {
      const tampered = {
        ...message,
        result: { ...message.result, sources: [{ ...message.result.sources[0]!, href }] },
      }
      expect(
        saveAssistantConversation(SCOPE, 'unsafe', { messages: [tampered], question: '' }, NOW),
      ).toBe(false)
    }
  })

  it('purges stale permissions and other accounts without clearing unrelated browser data', () => {
    localStorage.setItem('unrelated-preference', 'keep')
    saveAssistantConversation(SCOPE, 'old-role', CONVERSATION, NOW)
    localStorage.setItem(`${ASSISTANT_STORAGE_PREFIX}broken`, '{')
    pruneAssistantConversations(
      { userId: 'new-user', permissions: 'viewer:assigned:false:false' },
      NOW,
    )
    expect(localStorage.length).toBe(1)
    expect(localStorage.getItem('unrelated-preference')).toBe('keep')

    saveAssistantConversation(SCOPE, 'lead', CONVERSATION, NOW)
    clearAssistantConversations()
    expect(localStorage.length).toBe(1)
  })

  it('returns an in-memory fallback when storage is unavailable or full', () => {
    const write = vi.spyOn(window, 'localStorage', 'get').mockReturnValue({
      length: 0,
      key: () => null,
      getItem: () => null,
      removeItem: () => undefined,
      clear: () => undefined,
      setItem: () => {
        throw new Error('Quota exceeded')
      },
    })
    try {
      expect(saveAssistantConversation(SCOPE, 'lead', CONVERSATION, NOW)).toBe(false)
    } finally {
      write.mockRestore()
    }
    const read = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('Storage blocked')
    })
    try {
      expect(readAssistantConversation(SCOPE, 'lead', NOW)).toBeNull()
      expect(() => pruneAssistantConversations(SCOPE, NOW)).not.toThrow()
    } finally {
      read.mockRestore()
    }
  })
})
