'use client'

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react'

import type { CurrentUser } from '@/lib/auth'
import { createAssistantSessionStore } from '@/lib/leads/assistant-conversation-store'
import {
  clearAssistantConversations,
  pruneAssistantConversations,
} from '@/lib/leads/assistant-storage'
import { can } from '@/lib/permissions'
import { getBrowserClient } from '@/lib/supabase/browser'

type SessionStore = ReturnType<typeof createAssistantSessionStore>
const AssistantSessionContext = createContext<SessionStore | null>(null)
type AssistantUser = Pick<CurrentUser, 'id' | 'role' | 'accessScope'>

export function AssistantSessionProvider({
  user,
  children,
}: {
  user: AssistantUser
  children: ReactNode
}) {
  const permissions = `${user.role}:${user.accessScope}:${can(user.role, 'proposals.prices')}:${can(user.role, 'finance.read')}`
  const session = useMemo(
    () => createAssistantSessionStore({ userId: user.id, permissions }),
    [user.id, permissions],
  )

  useEffect(() => {
    pruneAssistantConversations(session.scope)
    session.activate()
    const {
      data: { subscription },
    } = getBrowserClient().auth.onAuthStateChange((event, authSession) => {
      if (event === 'SIGNED_OUT' || (authSession && authSession.user.id !== user.id)) {
        // Disable writers first: an in-flight request must not recreate deleted history.
        session.deactivate()
        clearAssistantConversations()
      }
    })
    function onStorage(event: StorageEvent) {
      if (event.storageArea === window.localStorage) session.reload(event.key)
    }
    window.addEventListener('storage', onStorage)
    return () => {
      subscription.unsubscribe()
      window.removeEventListener('storage', onStorage)
      session.deactivate()
    }
  }, [session, user.id])

  return (
    <AssistantSessionContext.Provider key={`${user.id}:${permissions}`} value={session}>
      {children}
    </AssistantSessionContext.Provider>
  )
}

export function useAssistantConversation(leadId: string) {
  const session = useContext(AssistantSessionContext)
  if (!session) throw new Error('Lead assistant requires an authenticated session provider')
  const store = session.getConversation(leadId)
  const conversation = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  )
  useEffect(() => {
    store.hydrate()
  }, [store])
  return { ...conversation, update: store.update, reset: store.reset }
}
