"use client";

import { Select } from "@/components/ui/select";
import { useTransition } from "react";
import { toast } from "sonner";
import { updateLeadStatus } from "../actions";

const OPTIONS = [
  { value: "new", label: "Nuevo" },
  { value: "qualifying", label: "En cualificación" },
  { value: "quoted", label: "Presupuestado" },
  { value: "won", label: "Ganado" },
  { value: "lost", label: "Perdido" },
  { value: "archived", label: "Archivado" },
] as const;

export function LeadStatusSelect({ leadId, status }: { leadId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Select
      defaultValue={status}
      disabled={pending}
      className="h-8 w-40"
      onChange={(e) => {
        const next = e.target.value;
        startTransition(async () => {
          const res = await updateLeadStatus({ leadId, status: next });
          if (!res.ok) toast.error(res.error);
          else toast.success("Estado actualizado");
        });
      }}
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
