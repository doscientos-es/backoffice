"use client";

import { Select } from "@/components/ui/select";
import { useOptimisticUpdate } from "@/lib/hooks/use-optimistic-update";
import type { LeadStatusType } from "@/lib/schemas/lead";
import { useState } from "react";
import { updateLeadStatus } from "../actions";
import { CloseReasonDialog, type CloseReasonVariant } from "../close-reason-dialog";
import { QuotedSuggestionDialog } from "../quoted-suggestion-dialog";

const OPTIONS = [
  { value: "new", label: "Nuevo" },
  { value: "qualifying", label: "En cualificación" },
  { value: "quoted", label: "Presupuestado" },
  { value: "won", label: "Ganado" },
  { value: "lost", label: "Perdido" },
  { value: "not_interested", label: "No interesa" },
  { value: "archived", label: "Archivado" },
] as const;

const CLOSURE_VARIANTS: Record<string, CloseReasonVariant> = {
  lost: "lost",
  not_interested: "not_interested",
};

export function LeadStatusSelect({
  leadId,
  status,
  leadName,
}: {
  leadId: string;
  status: string;
  leadName: string;
}) {
  const { value: currentStatus, commit } = useOptimisticUpdate<LeadStatusType>(
    status as LeadStatusType,
  );
  const [pendingClosure, setPendingClosure] = useState<CloseReasonVariant | null>(null);
  const [showQuotedSuggestion, setShowQuotedSuggestion] = useState(false);

  const apply = (to: LeadStatusType, lostReason?: string) => {
    commit(to, () => updateLeadStatus({ leadId, status: to, lostReason }));
    if (to === "quoted") setShowQuotedSuggestion(true);
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={currentStatus}
        className="h-8 w-40"
        onChange={(e) => {
          const next = e.target.value as LeadStatusType;
          const variant = CLOSURE_VARIANTS[next];
          if (variant) {
            setPendingClosure(variant);
            return;
          }
          apply(next);
        }}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>

      <CloseReasonDialog
        lead={pendingClosure ? { id: leadId, name: leadName } : null}
        variant={pendingClosure ?? "lost"}
        onCancel={() => setPendingClosure(null)}
        onConfirm={(reason) => {
          if (!pendingClosure) return;
          const next = pendingClosure;
          setPendingClosure(null);
          apply(next, reason);
        }}
      />

      <QuotedSuggestionDialog
        lead={showQuotedSuggestion ? { id: leadId, name: leadName } : null}
        onClose={() => setShowQuotedSuggestion(false)}
      />
    </div>
  );
}
