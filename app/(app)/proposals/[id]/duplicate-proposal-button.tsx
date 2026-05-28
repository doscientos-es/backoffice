"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { duplicateProposal } from "../actions";

/**
 * Clones the current proposal as a new draft and navigates to it. The new
 * draft starts unsigned, untokened and without a series number — it only
 * consumes a number when the user explicitly sends it. Used as the standard
 * "re-quote" affordance after a rejection or for iterative variants.
 */
export function DuplicateProposalButton({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const res = await duplicateProposal({ id: proposalId });
      if (res.ok) router.push(`/proposals/${res.id}`);
    });
  };

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={pending}>
      {pending ? "Duplicando…" : "Duplicar"}
    </Button>
  );
}
