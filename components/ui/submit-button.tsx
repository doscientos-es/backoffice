"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

type ButtonProps = React.ComponentProps<typeof Button>;

export interface SubmitButtonProps extends Omit<ButtonProps, "type"> {
  pendingLabel?: string;
  /**
   * Explicit loading state for client-side `onSubmit` handlers that do not use
   * server actions (i.e. `useFormStatus` would not report pending). When set,
   * it is ORed with the form status to drive the disabled/spinner state.
   */
  loading?: boolean;
  children: React.ReactNode;
}

export function SubmitButton({
  pendingLabel,
  loading,
  children,
  disabled,
  size = "sm",
  ...rest
}: SubmitButtonProps) {
  const { pending: formPending } = useFormStatus();
  const pending = formPending || loading;
  return (
    <Button
      type="submit"
      size={size}
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      {...rest}
    >
      {pending ? (
        <>
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {pendingLabel ?? "Guardando…"}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
