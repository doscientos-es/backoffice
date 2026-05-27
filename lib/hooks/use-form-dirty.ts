"use client";

import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

/**
 * Snapshots the form's current FormData as a stable, comparable string so we
 * can detect whether the user has modified anything since mount.
 *
 * Sorting the entries makes the result independent of insertion order, which
 * matters for forms whose fields render conditionally (e.g. GitHub sync).
 */
function snapshot(form: HTMLFormElement): string {
  const fd = new FormData(form);
  const entries: Array<[string, string]> = [];
  for (const [k, v] of fd.entries()) {
    entries.push([k, typeof v === "string" ? v : v.name]);
  }
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify(entries);
}

export interface UseFormDirtyResult<T extends HTMLFormElement = HTMLFormElement> {
  formRef: RefObject<T | null>;
  isDirty: boolean;
  /** Re-snapshot the current state as the new baseline (e.g. after a save). */
  reset: () => void;
}

/**
 * Tracks whether any field inside the referenced `<form>` has changed compared
 * to the initial state captured on mount. Use to gate save buttons so users
 * can't submit a form they haven't actually edited.
 */
export function useFormDirty<T extends HTMLFormElement = HTMLFormElement>(): UseFormDirtyResult<T> {
  const formRef = useRef<T | null>(null);
  const baseline = useRef<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const recompute = useCallback(() => {
    const form = formRef.current;
    if (!form || baseline.current === null) return;
    setIsDirty(snapshot(form) !== baseline.current);
  }, []);

  const reset = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    baseline.current = snapshot(form);
    setIsDirty(false);
  }, []);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    baseline.current = snapshot(form);
    setIsDirty(false);
    form.addEventListener("input", recompute);
    form.addEventListener("change", recompute);
    form.addEventListener("reset", recompute);
    return () => {
      form.removeEventListener("input", recompute);
      form.removeEventListener("change", recompute);
      form.removeEventListener("reset", recompute);
    };
  }, [recompute]);

  return { formRef, isDirty, reset };
}
