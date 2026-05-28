"use client";

import { LineItemsTable } from "@/components/finance/line-items-table";
import { AutosaveIndicator } from "@/components/ui/autosave-indicator";
import { Card, CardContent } from "@/components/ui/card";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EMPTY_LINE_ITEM, type LineItem } from "@/lib/finance";
import { useAutosave } from "@/lib/hooks/use-autosave";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createProposalAction, updateProposal } from "../actions";

type Props = {
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string; client_id: string | null }>;
  initialClientId?: string;
  initialProjectId?: string;
};

export function NewProposalForm({ clients, projects, initialClientId, initialProjectId }: Props) {
  const router = useRouter();
  const [proposalId, setProposalId] = useState<string | null>(null);

  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const [title, setTitle] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    { ...EMPTY_LINE_ITEM, id: crypto.randomUUID() },
  ]);

  const payload = useMemo(
    () => ({
      client_id: clientId,
      project_id: projectId || null,
      title,
      valid_until: validUntil || null,
      notes: notes || null,
      items,
    }),
    [clientId, projectId, title, validUntil, notes, items],
  );

  // Autosave logic
  const { status, savedAt, error } = useAutosave({
    data: payload,
    // Only enable once we have at least a title and a client
    enabled: Boolean(clientId && title.length > 2),
    onSave: async (data) => {
      if (!proposalId) {
        // First save -> Create
        const res = await createProposalAction(data);
        if (res.ok) {
          setProposalId(res.id);
          // Update URL without full reload if possible, or just stay here.
          // For consistency with collaborative editing, we should probably stay
          // or redirect to the full editor.
          // User said "autosave in forms", if we redirect it might be annoying.
          // But usually New -> Edit is the flow.
          // Let's use router.replace to update URL to /proposals/[id]
          window.history.replaceState(null, "", `/proposals/${res.id}`);
        } else {
          return { error: res.error };
        }
      } else {
        // Subsequent saves -> Update
        const res = await updateProposal({ id: proposalId, ...data });
        if (!res.ok) return { error: res.error };
      }
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <AutosaveIndicator status={status} savedAt={savedAt} error={error} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormRow
              label="Cliente"
              htmlFor="client_id"
              required
              hint="Destinatario de la propuesta."
            >
              <Select
                id="client_id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
              >
                <option value="" disabled>
                  — Selecciona cliente —
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormRow>
            <FormRow
              label="Proyecto"
              htmlFor="project_id"
              hint="Opcional. Asocia la propuesta a un proyecto existente."
            >
              <Select
                id="project_id"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">— Sin proyecto —</option>
                {projects
                  .filter((p) => !clientId || p.client_id === clientId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </Select>
            </FormRow>
            <FormRow label="Título" htmlFor="title" required>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
                autoFocus
                placeholder="Propuesta de servicios"
              />
            </FormRow>
            <FormRow label="Válida hasta" htmlFor="valid_until" hint="Fecha límite de aceptación.">
              <Input
                id="valid_until"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </FormRow>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-4 text-sm font-semibold">Líneas</h2>
          <LineItemsTable items={items} onChange={setItems} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <FormRow
            label="Notas"
            htmlFor="notes"
            hint="Condiciones generales, alcance o aclaraciones para el cliente."
          >
            <Textarea
              id="notes"
              rows={4}
              maxLength={4000}
              placeholder="Condiciones, alcance, observaciones…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormRow>
        </CardContent>
      </Card>
    </div>
  );
}
