"use client";

import { claimLead } from "@/app/(app)/leads/actions";
import { Button } from "@/components/ui/button";
import { Hand, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Claims an unowned lead for the current member. On success refreshes the
 * dashboard so the lead drops out of the "sin asignar" list and into "mis
 * leads". On failure (e.g. someone else claimed it first) shows the reason.
 */
export function ClaimLeadButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const res = await claimLead({ leadId });
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      data-icon="inline-start"
      disabled={pending}
      onClick={onClick}
      title={error ?? "Asignármelo"}
      aria-label="Asignarme este lead"
    >
      {pending ? <Loader2 className="animate-spin" /> : <Hand />}
      {error ? "Reintentar" : "Asignármelo"}
    </Button>
  );
}
