import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAssistantSessionStore } from './assistant-conversation-store'
import {
  ASSISTANT_HISTORY_TTL,
  assistantStorageKey,
  saveAssistantConversation,
} from './assistant-storage'

const SCOPE = { userId: 'synthetic-user', permissions: 'member:all:true:false' }

describe('assistant conversation store', () => {
  let session: ReturnType<typeof createAssistantSessionStore>
  beforeEach(() => {
    localStorage.clear()
    session = createAssistantSessionStore(SCOPE)
  })
  afterEach(() => {
    session.deactivate()
    vi.useRealTimers()
  })

  it('shares state between assistant views, isolates leads and never saves on hydration', () => {
    saveAssistantConversation(SCOPE, 'lead-one', { messages: [], question: 'Sin enviar' })
    const stored = localStorage.getItem(assistantStorageKey(SCOPE, 'lead-one'))
    const first = session.getConversation('lead-one')
    const second = session.getConversation('lead-one')
    const notified = vi.fn()
    const unsubscribe = second.subscribe(notified)
    first.hydrate()
    expect(first).toBe(second)
    expect(second.getSnapshot().question).toBe('Sin enviar')
    expect(localStorage.getItem(assistantStorageKey(SCOPE, 'lead-one'))).toBe(stored)
    first.update((current) => ({ ...current, question: 'Editada' }))
    expect(second.getSnapshot().question).toBe('Editada')
    expect(session.getConversation('lead-two').getSnapshot().question).toBe('')
    expect(notified).toHaveBeenCalledTimes(2)
    unsubscribe()
  })

  it('clears memory and blocks late writes after the session is deactivated', () => {
    const conversation = session.getConversation('lead')
    conversation.hydrate()
    conversation.update((current) => ({ ...current, question: 'Anterior' }))
    session.deactivate()
    conversation.update((current) => ({ ...current, question: 'Respuesta tardía' }))
    expect(conversation.getSnapshot().question).toBe('')
    expect(conversation.getSnapshot().ready).toBe(false)
    expect(JSON.parse(localStorage.getItem(assistantStorageKey(SCOPE, 'lead'))!).question).toBe(
      'Anterior',
    )
  })

  it('expires visible history after inactivity and invalidates pending answers', () => {
    vi.useFakeTimers()
    const conversation = session.getConversation('lead')
    const unsubscribe = conversation.subscribe(vi.fn())
    conversation.hydrate()
    conversation.update((current) => ({ ...current, question: 'Temporal' }))
    const generation = conversation.getSnapshot().generation
    vi.advanceTimersByTime(ASSISTANT_HISTORY_TTL - 1)
    expect(conversation.getSnapshot().question).toBe('Temporal')
    vi.advanceTimersByTime(1)
    expect(conversation.getSnapshot().question).toBe('')
    expect(conversation.getSnapshot().generation).toBeGreaterThan(generation)
    expect(localStorage.length).toBe(0)
    unsubscribe()
  })

  it('reloads edits and deletion from another tab without recreating a deleted record', () => {
    const conversation = session.getConversation('lead')
    conversation.hydrate()
    saveAssistantConversation(SCOPE, 'lead', { messages: [], question: 'Desde otra pestaña' })
    session.reload(assistantStorageKey(SCOPE, 'lead'))
    expect(conversation.getSnapshot().question).toBe('Desde otra pestaña')
    localStorage.removeItem(assistantStorageKey(SCOPE, 'lead'))
    session.reload(assistantStorageKey(SCOPE, 'lead'))
    expect(conversation.getSnapshot().question).toBe('')
    expect(localStorage.length).toBe(0)
  })

  it('can reactivate after strict-mode effect cleanup without losing saved history', () => {
    const conversation = session.getConversation('lead')
    conversation.hydrate()
    conversation.update((current) => ({ ...current, question: 'Conservar' }))
    session.deactivate()
    session.activate()
    expect(conversation.getSnapshot().ready).toBe(true)
    expect(conversation.getSnapshot().question).toBe('Conservar')
  })
})
