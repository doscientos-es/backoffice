"use client";

import { type FormFeedbackState, useFormFeedback } from "@/components/ui/form-feedback";
import type { ActionResult } from "@/lib/actions/types";
import type { FormEvent } from "react";

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
 * `defineAction`-wrapped server action: prevent default, snapshot `FormData`,
 * flip to pending, then surface the error or success.
 *
 * Why the bare `catch { throw }`: `defineAction` turns validation and domain
 * failures into `{ ok: false }` results — it never throws those. The only
 * throws that reach here are Next.js control-flow signals (`redirect()` /
 * `notFound()`), which MUST propagate so the framework performs the
 * navigation. Swallowing them would strand the user on a "pending" form.
 */
export function useActionForm(
  action: ActionFn,
  options: UseActionFormOptions = {},
): UseActionFormResult {
  const feedback = useFormFeedback();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Capture synchronously: React nulls out `currentTarget` after the handler
    // returns, and we read it again after the `await`.
    const form = e.currentTarget;
    feedback.setPending();
    const res = await action(new FormData(form));
    if (res && !res.ok) {
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
