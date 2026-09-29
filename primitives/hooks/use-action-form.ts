"use client";

import { type FormFeedbackState, useFormFeedback } from "@doscientos/ui";
import { type FormEvent, useRef } from "react";

import type { ActionFailure, ActionResult } from "../lib/types";

/**
 * A server action invoked from a client form. It receives the form's
 * `FormData` and either returns an {@link ActionResult} (validation / domain
 * outcome) or never resolves normally because it `redirect()`s.
 */
type ActionFn = (formData: FormData) => Promise<ActionResult | undefined>;

interface UseActionFormOptions {
  /**
   * Feedback shown when the action succeeds without navigating away. Omit for
   * redirecting actions (the page changes before any message would be seen).
   */
  successMessage?: string;
  /**
   * Runs after a successful, non-redirecting submit. Receives the form element
   * captured synchronously, so it stays valid across the `await`.
   */
  onSuccess?: (form: HTMLFormElement) => void;
  /** Return true when the caller has shown a specialized failure UI. */
  onFailure?: (result: ActionFailure) => boolean | undefined;
}

export interface UseActionFormResult {
  /** Feedback state to drive `<FormFeedback />` (or a custom error banner). */
  state: FormFeedbackState;
  pending: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Reset feedback to idle (e.g. when a dialog closes). */
  reset: () => void;
}

/**
 * Centralizes the submit lifecycle shared by every client form that calls a
 * server action: prevent default, snapshot `FormData`, flip to pending, then
 * surface the error or success.
 */
function isNavigationError(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && /^NEXT_(REDIRECT|NOT_FOUND|HTTP_ERROR)/.test(digest);
}

export function useActionForm(
  action: ActionFn,
  options: UseActionFormOptions = {},
): UseActionFormResult {
  const feedback = useFormFeedback();
  const inFlight = useRef(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    const form = e.currentTarget;
    feedback.setPending();
    let res: ActionResult | undefined;
    try {
      res = await action(new FormData(form));
    } catch (err) {
      if (isNavigationError(err)) throw err;
      feedback.setError("No se pudo conectar con el servidor. Inténtalo de nuevo.");
      return;
    } finally {
      inFlight.current = false;
    }
    if (res && !res.ok) {
      if (options.onFailure?.(res)) {
        feedback.reset();
        return;
      }
      feedback.setError(res.error);
      return;
    }
    feedback.setSuccess(options.successMessage);
    options.onSuccess?.(form);
  }

  return {
    state: feedback.state,
    pending: feedback.pending,
    onSubmit,
    reset: feedback.reset,
  };
}
