"use client";

import { useCallback, useEffect, useState } from "react";

export type BrowserNotifPermission = "default" | "granted" | "denied";

export type BrowserNotifPayload = {
  title: string;
  body?: string;
  icon?: string;
  tag?: string;
};

/**
 * Thin wrapper around the Web Notifications API.
 *
 * - `permission` is kept in sync with the browser state (syncs on tab focus).
 * - `requestPermission()` opens the browser prompt and updates state.
 * - `notify()` fires a native OS notification; no-ops when permission is not granted.
 */
export function useBrowserNotifications() {
  const supported = typeof window !== "undefined" && "Notification" in window;

  const [permission, setPermission] = useState<BrowserNotifPermission>(() =>
    supported ? (Notification.permission as BrowserNotifPermission) : "denied",
  );

  // Re-sync when the user switches back to the tab (they may have changed settings)
  useEffect(() => {
    if (!supported) return;
    const sync = () => setPermission(Notification.permission as BrowserNotifPermission);
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, [supported]);

  const requestPermission = useCallback(async (): Promise<BrowserNotifPermission> => {
    if (!supported) return "denied";
    const result = await Notification.requestPermission();
    setPermission(result as BrowserNotifPermission);
    return result as BrowserNotifPermission;
  }, [supported]);

  const notify = useCallback(
    ({ title, body, icon, tag }: BrowserNotifPayload) => {
      if (!supported || Notification.permission !== "granted") return;
      try {
        const n = new Notification(title, { body, icon, tag });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      } catch {
        // Some contexts (iframes, incognito with policy) may throw — ignore.
      }
    },
    [supported],
  );

  return { supported, permission, requestPermission, notify };
}
