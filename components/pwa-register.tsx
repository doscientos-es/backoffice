"use client";

import { useEffect } from "react";
import { STARTUP_SPLASH_SESSION_KEY } from "@/lib/startup-splash";

/** Registers the PWA service worker after the page loads. */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => { });
    }

    try {
      window.sessionStorage.setItem(STARTUP_SPLASH_SESSION_KEY, "1");
    } catch {
      /* The splash still hides when sessionStorage is unavailable. */
    }

    const timer = window.setTimeout(() => {
      document.getElementById("startup-splash")?.classList.add("is-hidden");
    }, 450);
    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
