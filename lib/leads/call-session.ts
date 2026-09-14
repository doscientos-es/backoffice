export const CALL_SESSION_TTL_HOURS = 4
export const MISSED_CALL_THRESHOLD_SECONDS = 30

export type CallCompletion = {
  durationMinutes: number
  durationSeconds: number
  defaultOutcome: 'connected' | 'no_answer'
}

/**
 * Browser dialers cannot confirm whether a person answered. This derives only
 * the elapsed attempt duration and labels very short attempts as unanswered.
 */
export function completeCallSession(
  startedAt: string,
  dialedAt: string | null,
  finishedAt = new Date().toISOString(),
): CallCompletion {
  const startedMs = new Date(dialedAt ?? startedAt).getTime()
  const finishedMs = new Date(finishedAt).getTime()
  const durationSeconds = Math.max(0, Math.floor((finishedMs - startedMs) / 1_000))

  return {
    durationSeconds,
    durationMinutes:
      durationSeconds < MISSED_CALL_THRESHOLD_SECONDS ? 0 : Math.max(1, Math.round(durationSeconds / 60)),
    defaultOutcome: durationSeconds < MISSED_CALL_THRESHOLD_SECONDS ? 'no_answer' : 'connected',
  }
}