"use client";

import { completeReminder } from "@/app/(app)/reminders/actions";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { useTransition } from "react";

export function ReminderCompleteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      await completeReminder({ id });
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label="Marcar como completado"
      title="Marcar como completado"
      disabled={pending}
      onClick={onClick}
    >
      {pending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
    </Button>
  );
}
