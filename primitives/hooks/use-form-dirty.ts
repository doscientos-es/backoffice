"use client";

import { type RefCallback, useCallback, useRef, useState } from "react";

/**
 * Snapshots the form's current FormData as a stable, comparable string so we
 * can detect whether the user has modified anything since mount.
 */
export function snapshot(form: HTMLFormElement): string {
  const fd = new FormData(form);
  const entries: Array<[string, string]> = [];
  for (const [k, v] of fd.entries()) {
    entries.push([k, typeof v === "string" ? v : v.name]);
  }
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify(entries);
}

export interface UseFormDirtyResult<T extends HTMLFormElement = HTMLFormElement> {
  /**
   * Callback ref — pass directly to `<form ref={formRef}>`.
   * Captures the baseline the moment the form element mounts into the DOM.
   */
  formRef: RefCallback<T | null>;
  isDirty: boolean;
  /** Marks the form dirty for controlled fields that do not emit DOM events. */
  markDirty: () => void;
  /** Re-snapshot the current state as the new baseline (e.g. after a save). */
  reset: () => void;
}

/**
 * Tracks whether any field inside the referenced `<form>` has changed compared
 * to the initial state captured on mount.
 */
export function useFormDirty<T extends HTMLFormElement = HTMLFormElement>(): UseFormDirtyResult<T> {
  const formEl = useRef<T | null>(null);
  const baseline = useRef<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const markDirty = useCallback(() => setIsDirty(true), []);

  const recompute = useCallback(() => {
    const form = formEl.current;
    if (!form || baseline.current === null) return;
    setIsDirty(snapshot(form) !== baseline.current);
  }, []);

  const reset = useCallback(() => {
    const form = formEl.current;
    if (!form) return;
    baseline.current = snapshot(form);
    setIsDirty(false);
  }, []);

  const formRef = useCallback<RefCallback<T | null>>(
    (form) => {
      if (formEl.current) {
        formEl.current.removeEventListener("input", recompute);
        formEl.current.removeEventListener("change", recompute);
        formEl.current.removeEventListener("reset", recompute);
      }
      formEl.current = form;
      if (form) {
        baseline.current = snapshot(form);
        setIsDirty(false);
        form.addEventListener("input", recompute);
        form.addEventListener("change", recompute);
        form.addEventListener("reset", recompute);
      }
    },
    [recompute],
  );

  return { formRef, isDirty, reset, markDirty };
}
