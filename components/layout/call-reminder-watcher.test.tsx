import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { notifyDueCallReminders } = vi.hoisted(() => ({ notifyDueCallReminders: vi.fn() }))

vi.mock('@/app/(app)/leads/actions', () => ({ notifyDueCallReminders }))

import { CALL_REMINDER_DELAY_MS, CALL_REMINDER_SCHEDULED_EVENT } from '@/lib/leads/call-workflow'

import { CallReminderWatcher } from './call-reminder-watcher'

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
}

describe('CallReminderWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.clear()
    setVisibility('visible')
    notifyDueCallReminders.mockReset().mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    setVisibility('visible')
  })

  it('defers the initial Server Action until after startup', async () => {
    render(<CallReminderWatcher />)

    expect(notifyDueCallReminders).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2_000)
    expect(notifyDueCallReminders).toHaveBeenCalledWith({})
  })

  it('consumes rejected background actions', async () => {
    notifyDueCallReminders.mockRejectedValue(new Error('unexpected response'))
    render(<CallReminderWatcher />)

    await vi.advanceTimersByTimeAsync(2_000)
    await Promise.resolve()
    expect(notifyDueCallReminders).toHaveBeenCalledOnce()
  })

  it('polls slowly and skips focus checks right after a previous check', async () => {
    render(<CallReminderWatcher />)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(notifyDueCallReminders).toHaveBeenCalledOnce()

    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(60_000)
    expect(notifyDueCallReminders).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(notifyDueCallReminders).toHaveBeenCalledTimes(2)
  })

  it('shares the last check between tabs', async () => {
    window.localStorage.setItem('call-reminders:last-check', String(Date.now()))
    render(<CallReminderWatcher />)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(notifyDueCallReminders).not.toHaveBeenCalled()
  })

  it('does not poll while the tab is hidden and catches up when visible', async () => {
    setVisibility('hidden')
    render(<CallReminderWatcher />)
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(notifyDueCallReminders).not.toHaveBeenCalled()

    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(notifyDueCallReminders).toHaveBeenCalledOnce()
  })

  it("checks exactly when a started call's reminder is due, even if hidden", async () => {
    render(<CallReminderWatcher />)
    await vi.advanceTimersByTimeAsync(2_000)
    notifyDueCallReminders.mockClear()

    window.dispatchEvent(new Event(CALL_REMINDER_SCHEDULED_EVENT))
    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(CALL_REMINDER_DELAY_MS)
    expect(notifyDueCallReminders).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(2_000)
    expect(notifyDueCallReminders).toHaveBeenCalledOnce()
  })
})
