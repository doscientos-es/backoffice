"use client";

import { useEffect } from "react";

import { notifyDueCallReminders } from "@/app/(app)/leads/actions";
import { CALL_REMINDER_DELAY_MS, CALL_REMINDER_SCHEDULED_EVENT } from "@/lib/leads/call-workflow";

const POLL_INTERVAL_MS = 5 * 60_000;
const STARTUP_DELAY_MS = 2_000;
const RESUME_MIN_GAP_MS = 30_000;
const SCHEDULED_CHECK_GRACE_MS = 2_000;
const LAST_CHECK_KEY = "call-reminders:last-check";

function readLastCheck(): number {
  try {
    return Number(window.localStorage.getItem(LAST_CHECK_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeLastCheck(at: number) {
  try {
    window.localStorage.setItem(LAST_CHECK_KEY, String(at));
  } catch {
    // Storage may be unavailable (private mode); checks still run per tab.
  }
}

/**
 * Lightweight in-app scheduler. It needs no cron or paid worker: a call start
 * schedules an exact check for when its reminder becomes due, while a slow
 * poll and resume checks catch up on reminders from other tabs or reloads.
 * Open tabs share the last check time so they do not repeat each other's work.
 */
export function CallReminderWatcher() {
  useEffect(() => {
    // It is background housekeeping, not a prerequisite for showing the app.
    // Defer it so the initial RSC and client bundles are not competing with a
    // Server Action. Always consume failures: expired sessions or deployment
    // races otherwise surface as an unhandled Next.js action error.
    const check = (minGapMs: number, { force = false } = {}) => {
      if (!force && document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - readLastCheck() < minGapMs) return;
      writeLastCheck(now);
      void notifyDueCallReminders({}).catch(() => undefined);
    };
    const onResume = () => check(RESUME_MIN_GAP_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") onResume();
    };
    const scheduledTimers = new Set<number>();
    const onCallScheduled = () => {
      const timer = window.setTimeout(() => {
        scheduledTimers.delete(timer);
        check(0, { force: true });
      }, CALL_REMINDER_DELAY_MS + SCHEDULED_CHECK_GRACE_MS);
      scheduledTimers.add(timer);
    };

    const startupTimer = window.setTimeout(onResume, STARTUP_DELAY_MS);
    const interval = window.setInterval(
      () => check(POLL_INTERVAL_MS - RESUME_MIN_GAP_MS),
      POLL_INTERVAL_MS,
    );
    window.addEventListener("focus", onResume);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener(CALL_REMINDER_SCHEDULED_EVENT, onCallScheduled);
    return () => {
      window.clearTimeout(startupTimer);
      window.clearInterval(interval);
      for (const timer of scheduledTimers) window.clearTimeout(timer);
      window.removeEventListener("focus", onResume);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener(CALL_REMINDER_SCHEDULED_EVENT, onCallScheduled);
    };
  }, []);

  return null;
}
