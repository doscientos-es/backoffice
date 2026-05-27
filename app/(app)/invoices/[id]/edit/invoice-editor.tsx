"use client";

import { LineItemsTable } from "@/components/finance/line-items-table";
import { AutosaveIndicator } from "@/components/ui/autosave-indicator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EMPTY_LINE_ITEM, type LineItem } from "@/lib/finance";
import { useAutosave } from "@/lib/hooks/use-autosave";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { updateInvoice } from "../../actions";

export type EditableItem = LineItem;

export type InvoiceEditorProps = {
  id: string;
  initialIssueDate: string;
  initialDueDate: string;
  initialNotes: string | null;
  initialItems: EditableItem[];
  /** When true, fields are read-only (invoice issued). */
  locked: boolean;
};

export function InvoiceEditor({
  id,
  initialIssueDate,
  initialDueDate,
  initialNotes,
  initialItems,
  locked,
}: InvoiceEditorProps) {
  const router = useRouter();
  const [saving, startTransition] = useTransition();

  const [issueDate, setIssueDate] = useState(initialIssueDate);
  const [dueDate, setDueDate] = useState(initialDueDate);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [items, setItems] = useState<EditableItem[]>(
    initialItems.length > 0
      ? initialItems.map((it) => ({ ...it, id: it.id || crypto.randomUUID() }))
      : [{ ...EMPTY_LINE_ITEM, id: crypto.randomUUID() } as EditableItem],
  );

  const payload = useMemo(
    () => ({
      id,
      issue_date: issueDate,
      due_date: dueDate,
      notes: notes || null,
      items,
    }),
    [id, issueDate, dueDate, notes, items],
  );

  const autosave = useAutosave({
    data: payload,
    enabled: !locked,
    storageKey: `invoice-edit:${id}`,
    onSave: async (data) => {
      const res = await updateInvoice(data);
      if (!res.ok) return { error: res.error };
    },
  });

  const handleSaveAndReturn = () => {
    startTransition(async () => {
      await autosave.saveNow();
      router.push(`/invoices/${id}`);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Líneas</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <LineItemsTable items={items} onChange={setItems} locked={locked} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detalles</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FormRow label="Fecha de emisión" htmlFor="issue-date">
              <Input
                id="issue-date"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                disabled={locked}
              />
            </FormRow>
            <FormRow label="Fecha de vencimiento" htmlFor="due-date">
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={locked}
              />
            </FormRow>
            <FormRow label="Notas" htmlFor="notes">
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={locked}
                rows={6}
                placeholder="Notas internas o para el cliente…"
              />
            </FormRow>
          </CardContent>
        </Card>
      </div>

      {/* Sticky action bar — bleeds to the edges of <main> via negative margins
          so it spans the available content width without overlapping the sidebar. */}
      <div className="sticky bottom-0 z-10 -mx-4 -mb-4 border-t border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:-mx-6 md:-mb-6">
        <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-6">
          <AutosaveIndicator
            status={autosave.status}
            savedAt={autosave.savedAt}
            error={autosave.error}
          />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/invoices/${id}`}>
                <ArrowLeft className="size-3.5" />
                Volver
              </Link>
            </Button>
            {!locked && (
              <Button
                size="sm"
                disabled={saving || autosave.status === "saving"}
                onClick={handleSaveAndReturn}
              >
                <Save className="size-3.5" />
                {saving ? "Guardando…" : "Guardar y volver"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
