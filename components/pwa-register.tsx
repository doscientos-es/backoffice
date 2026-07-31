"use client";

import { useEffect } from "react";

/** Registers the PWA service worker after the page loads. */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    window.setTimeout(() => {
      document.getElementById("startup-splash")?.classList.add("is-hidden");
    }, 450);
  }, []);

  return null;
}
