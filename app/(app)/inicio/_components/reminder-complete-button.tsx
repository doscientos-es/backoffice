"use client";

import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

/**
 * Purely presentational button — the parent (RemindersSection) owns the
 * optimistic state and wires the server action via `onCompleteAction`.
 */
export function ReminderCompleteButton({
  id,
  onCompleteAction,
}: {
  id: string;
  onCompleteAction: (id: string) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label="Marcar como completado"
      title="Marcar como completado"
      onClick={() => onCompleteAction(id)}
    >
      <Check className="size-3" />
    </Button>
  );
}
