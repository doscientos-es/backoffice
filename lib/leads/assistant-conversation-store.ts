import {
  ASSISTANT_MESSAGE_LIMIT,
  ASSISTANT_HISTORY_TTL,
  assistantStorageKey,
  readAssistantConversation,
  removeAssistantConversation,
  saveAssistantConversation,
  type AssistantConversation,
  type AssistantStorageScope,
} from './assistant-storage'

type Snapshot = AssistantConversation & { ready: boolean; persisted: boolean; generation: number }
const EMPTY: Snapshot = { messages: [], question: '', ready: false, persisted: true, generation: 0 }

/** One store per authenticated scope, shared by the drawer and the call workspace. */
export function createAssistantSessionStore(scope: AssistantStorageScope) {
  let active = true
  const conversations = new Map<string, ReturnType<typeof createConversation>>()

  function createConversation(leadId: string) {
    let snapshot = EMPTY
    let expiresAt = 0
    let expiry: ReturnType<typeof setTimeout> | undefined
    const listeners = new Set<() => void>()
    function publish(next: Snapshot) {
      snapshot = next
      for (const listener of listeners) listener()
    }
    function scheduleExpiry() {
      clearTimeout(expiry)
      if (!expiresAt || !listeners.size) return
      expiry = setTimeout(
        () => {
          removeAssistantConversation(scope, leadId)
          expiresAt = 0
          publish({ ...EMPTY, ready: true, generation: snapshot.generation + 1 })
        },
        Math.max(0, expiresAt - Date.now()),
      )
    }
    function hydrate(force = false) {
      if (!active || (snapshot.ready && !force && (!expiresAt || expiresAt > Date.now()))) return
      const stored = readAssistantConversation(scope, leadId)
      expiresAt = stored ? stored.updatedAt + ASSISTANT_HISTORY_TTL : 0
      publish({
        messages: stored?.messages ?? [],
        question: stored?.question ?? '',
        ready: true,
        persisted: true,
        generation: snapshot.generation + 1,
      })
      scheduleExpiry()
    }
    return {
      subscribe(listener: () => void) {
        listeners.add(listener)
        scheduleExpiry()
        return () => {
          listeners.delete(listener)
          if (!listeners.size) clearTimeout(expiry)
        }
      },
      getSnapshot: () => snapshot,
      getServerSnapshot: () => EMPTY,
      hydrate,
      update(change: (current: AssistantConversation) => AssistantConversation) {
        if (!active || !snapshot.ready) return
        const next = change(snapshot)
        const bounded = { ...next, messages: next.messages.slice(-ASSISTANT_MESSAGE_LIMIT) }
        const persisted = saveAssistantConversation(scope, leadId, bounded)
        expiresAt = Date.now() + ASSISTANT_HISTORY_TTL
        publish({ ...snapshot, ...bounded, persisted })
        scheduleExpiry()
      },
      reset() {
        if (!active) return
        const persisted = removeAssistantConversation(scope, leadId)
        clearTimeout(expiry)
        expiresAt = 0
        publish({ ...EMPTY, ready: true, persisted, generation: snapshot.generation + 1 })
      },
      clear() {
        clearTimeout(expiry)
        expiresAt = 0
        publish({ ...EMPTY, generation: snapshot.generation + 1 })
      },
    }
  }

  return {
    scope,
    getConversation(leadId: string) {
      let conversation = conversations.get(leadId)
      if (!conversation) {
        conversation = createConversation(leadId)
        conversations.set(leadId, conversation)
      }
      return conversation
    },
    activate() {
      active = true
      for (const conversation of conversations.values()) conversation.hydrate()
    },
    deactivate() {
      active = false
      for (const conversation of conversations.values()) conversation.clear()
    },
    reload(key: string | null) {
      for (const [leadId, conversation] of conversations) {
        if (key === null || key === assistantStorageKey(scope, leadId)) conversation.hydrate(true)
      }
    },
  }
}
