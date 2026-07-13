import type { RecoverySignals, RecoveryState } from "./types";

/**
 * Pure reducer mapping raw engagement signals to a funnel position. Ordered by
 * strength of intent so the strongest signal wins:
 *   engaged (replied/clicked) → opened → contacted → pending.
 */
export function getRecoveryState(signals: RecoverySignals): RecoveryState {
  if (signals.replied || signals.clicked) return "engaged";
  if (signals.opened) return "opened";
  if (signals.hasOutbound) return "contacted";
  return "pending";
}

/**
 * Whole days elapsed since an ISO timestamp, or null when absent. Used to
 * surface how long a lost lead has been sitting untouched.
 */
export function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}
