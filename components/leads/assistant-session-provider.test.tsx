import { act, cleanup, renderHook } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CurrentUser } from '@/lib/auth'
import { assistantStorageKey } from '@/lib/leads/assistant-storage'

const auth = vi.hoisted(() => ({
  callback: null as ((event: string, session: { user: { id: string } } | null) => void) | null,
  unsubscribe: vi.fn(),
}))
vi.mock('@/lib/supabase/browser', () => ({
  getBrowserClient: () => ({
    auth: {
      onAuthStateChange: (callback: typeof auth.callback) => {
        auth.callback = callback
        return { data: { subscription: { unsubscribe: auth.unsubscribe } } }
      },
    },
  }),
}))

import { AssistantSessionProvider, useAssistantConversation } from './assistant-session-provider'

const USER = { id: 'synthetic-user', role: 'member', accessScope: 'all' } as const

describe('assistant session lifecycle', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  it.each(['SIGNED_OUT', 'SIGNED_IN'])(
    'clears history and blocks late writers on %s for a different/no session',
    (event) => {
      const { result } = renderHook(() => useAssistantConversation('lead'), {
        wrapper: ({ children }) => (
          <AssistantSessionProvider user={USER}>{children}</AssistantSessionProvider>
        ),
      })
      act(() => result.current.update((current) => ({ ...current, question: 'Privado' })))
      localStorage.setItem('unrelated-preference', 'keep')
      const lateUpdate = result.current.update
      act(() =>
        auth.callback?.(event, event === 'SIGNED_IN' ? { user: { id: 'other-user' } } : null),
      )
      expect(result.current.question).toBe('')
      expect(result.current.ready).toBe(false)
      act(() => lateUpdate((current) => ({ ...current, question: 'Respuesta tardía' })))
      expect(localStorage.length).toBe(1)
      expect(localStorage.getItem('unrelated-preference')).toBe('keep')
    },
  )

  it.each([
    { ...USER, id: 'other-user' },
    { ...USER, role: 'viewer' as const },
    { ...USER, accessScope: 'assigned' as const },
  ])('invalidates saved messages when the user, role or access scope changes', (nextUser) => {
    let user: Pick<CurrentUser, 'id' | 'role' | 'accessScope'> = USER
    const { result, rerender } = renderHook(() => useAssistantConversation('lead'), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AssistantSessionProvider user={user}>{children}</AssistantSessionProvider>
      ),
    })
    act(() => result.current.update((current) => ({ ...current, question: 'Privado' })))
    expect(localStorage.length).toBe(1)
    user = nextUser
    rerender()
    expect(result.current.question).toBe('')
    expect(localStorage.length).toBe(0)
  })

  it('preserves local history in a strict-mode subtree and unsubscribes on unmount', () => {
    const { result, unmount } = renderHook(() => useAssistantConversation('lead'), {
      wrapper: ({ children }) => (
        <StrictMode>
          <AssistantSessionProvider user={USER}>{children}</AssistantSessionProvider>
        </StrictMode>
      ),
    })
    expect(result.current.ready).toBe(true)
    act(() => result.current.update((current) => ({ ...current, question: 'Conservar' })))
    unmount()
    expect(auth.unsubscribe).toHaveBeenCalled()
    const key = assistantStorageKey(
      { userId: USER.id, permissions: 'member:all:true:false' },
      'lead',
    )
    expect(JSON.parse(localStorage.getItem(key)!).question).toBe('Conservar')
  })
})
