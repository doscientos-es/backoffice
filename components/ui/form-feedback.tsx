"use client";

import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export type FormFeedbackState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "success"; message?: string }
  | { status: "error"; message: string };

export function useFormFeedback(options?: { successResetMs?: number }) {
  const resetMs = options?.successResetMs ?? 2500;
  const [state, setState] = useState<FormFeedbackState>({ status: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const setPending = useCallback(() => {
    clearTimer();
    setState({ status: "pending" });
  }, [clearTimer]);

  const setSuccess = useCallback(
    (message?: string) => {
      clearTimer();
      setState({ status: "success", message });
      if (resetMs > 0) {
        timer.current = setTimeout(() => setState({ status: "idle" }), resetMs);
      }
    },
    [clearTimer, resetMs],
  );

  const setError = useCallback(
    (message: string) => {
      clearTimer();
      setState({ status: "error", message });
    },
    [clearTimer],
  );

  const reset = useCallback(() => {
    clearTimer();
    setState({ status: "idle" });
  }, [clearTimer]);

  return {
    state,
    pending: state.status === "pending",
    setPending,
    setSuccess,
    setError,
    reset,
  };
}

interface FormFeedbackProps {
  state: FormFeedbackState;
  className?: string;
  pendingLabel?: string;
  successLabel?: string;
}

export function FormFeedback({
  state,
  className,
  pendingLabel = "Guardando…",
  successLabel = "Guardado",
}: FormFeedbackProps) {
  const isPending = state.status === "pending";
  const isSuccess = state.status === "success";
  const isError = state.status === "error";

  if (state.status === "idle") {
    return <span className={cn("inline-flex h-5 items-center gap-1.5 text-xs", className)} aria-hidden />;
  }

  return (
    <span
      role={isError ? "alert" : "status"}
      aria-live="polite"
      className={cn(
        "inline-flex h-5 items-center gap-1.5 text-xs tabular-nums",
        isPending && "text-muted-foreground",
        isSuccess && "text-success",
        isError && "text-destructive",
        className,
      )}
    >
      {isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
      {isSuccess ? <CheckCircle2 className="size-3.5" aria-hidden /> : null}
      {isError ? <AlertCircle className="size-3.5" aria-hidden /> : null}
      <span className="truncate">
        {isPending ? pendingLabel : null}
        {isSuccess ? (state.message ?? successLabel) : null}
        {isError ? state.message : null}
      </span>
    </span>
  );
}
