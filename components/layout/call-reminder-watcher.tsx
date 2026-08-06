"use client";

import { useEffect } from "react";
import { notifyDueCallReminders } from "@/app/(app)/leads/actions";

const POLL_INTERVAL_MS = 30_000;

/**
 * Lightweight in-app scheduler. It needs no cron or paid worker: the browser
 * checks due reminders while the backoffice is open and catches up on focus.
 */
export function CallReminderWatcher() {
  useEffect(() => {
    const check = () => void notifyDueCallReminders({});
    check();
    const interval = window.setInterval(check, POLL_INTERVAL_MS);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", check);
    };
  }, []);

  return null;
}
