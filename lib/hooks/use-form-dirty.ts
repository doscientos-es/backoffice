"use client";

import { type RefCallback, useCallback, useRef, useState } from "react";

/**
 * Snapshots the form's current FormData as a stable, comparable string so we
 * can detect whether the user has modified anything since mount.
 *
 * Sorting the entries makes the result independent of insertion order, which
 * matters for forms whose fields render conditionally (e.g. GitHub sync).
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
   * Callback ref — pass directly to the `<form ref={formRef}>`.
   * Using a callback ref (instead of useRef + useEffect) ensures the baseline
   * is captured the moment the form element mounts into the DOM, even when it
   * renders lazily inside a Dialog or other conditional wrapper.
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
 * to the initial state captured on mount. Use to gate save buttons so users
 * can't submit a form they haven't actually edited.
 *
 * Implementation note: we use a callback ref rather than `useRef + useEffect`
 * so the baseline is set exactly when the form element appears in the DOM.
 * With `useEffect`, the effect runs once on component mount — but if the form
 * lives inside a Dialog that starts closed, `formRef.current` is null at that
 * point and the baseline is never established, keeping `isDirty` stuck at
 * `false` for every change the user makes.
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

  /**
   * Callback ref: fires when the form element mounts (form !== null) and when
   * it unmounts (form === null). On mount we capture the baseline and attach
   * listeners; on unmount we remove them.
   */
  const formRef = useCallback<RefCallback<T | null>>(
    (form) => {
      // Clean up listeners from the previous element (handles remounts).
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
