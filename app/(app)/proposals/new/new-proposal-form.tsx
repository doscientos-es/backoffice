"use client";

import { LineItemsTable } from "@/components/finance/line-items-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { EMPTY_LINE_ITEM, type LineItem } from "@/lib/finance";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { updateLeadStatus } from "../../leads/actions";
import { createProposalAction } from "../actions";

type Props = {
  clients: Array<{ id: string; name: string }>;
  leads: Array<{ id: string; name: string; company: string | null; status: string }>;
  initialClientId?: string;
  initialLeadId?: string;
};

/** Statuses where the lead hasn't been quoted yet */
const BEFORE_QUOTED = new Set(["new", "qualifying"]);

type Recipient = { kind: "client"; id: string } | { kind: "lead"; id: string } | null;

/**
 * Explicit create flow for proposals. The detail page (`/proposals/[id]`)
 * owns the autosave-driven collaborative editor; here the user fills a draft
 * and confirms with a single click — on success we navigate to the detail
 * view where further edits are autosaved.
 *
 * The recipient is either an existing client OR an open lead: the proposal
 * never targets a project (projects are auto-generated on acceptance).
 */
export function NewProposalForm({ clients, leads, initialClientId, initialLeadId }: Props) {
  const router = useRouter();
  const feedback = useFormFeedback({ successResetMs: 4000 });
  const [pending, startTransition] = useTransition();

  const [recipient, setRecipient] = useState<Recipient>(() => {
    if (initialClientId) return { kind: "client", id: initialClientId };
    if (initialLeadId) return { kind: "lead", id: initialLeadId };
    return null;
  });
  const recipientValue = recipient ? `${recipient.kind}:${recipient.id}` : "";
  const [title, setTitle] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ ...EMPTY_LINE_ITEM, id: crypto.randomUUID() }]);
  const [pendingLeadMove, setPendingLeadMove] = useState<{
    leadId: string;
    leadName: string;
    proposalId: string;
  } | null>(null);

  const canSubmit = useMemo(() => {
    if (!recipient || title.trim().length < 1) return false;
    if (items.length === 0) return false;
    return items.every((it) => it.description.trim().length > 0 && Number(it.quantity) > 0);
  }, [recipient, title, items]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || pending || !recipient) {
      feedback.setError("Completa destinatario, título y al menos una línea con descripción");
      return;
    }
    feedback.setPending();
    startTransition(async () => {
      const res = await createProposalAction({
        client_id: recipient.kind === "client" ? recipient.id : undefined,
        lead_id: recipient.kind === "lead" ? recipient.id : undefined,
        title: title.trim(),
        valid_until: validUntil || undefined,
        notes: notes || undefined,
        items: items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          vat_rate: it.vat_rate,
          billing_cycle: it.billing_cycle ?? "none",
        })),
      });
      if (!res.ok) {
        feedback.setError(res.error);
        return;
      }
      feedback.setSuccess("Propuesta creada");

      // Suggest moving the lead to "quoted" if it's still in an earlier stage
      const selectedLead =
        recipient.kind === "lead" ? leads.find((l) => l.id === recipient.id) : null;
      if (selectedLead && BEFORE_QUOTED.has(selectedLead.status)) {
        setPendingLeadMove({
          leadId: selectedLead.id,
          leadName: selectedLead.name,
          proposalId: res.id,
        });
        return;
      }

      router.push(`/proposals/${res.id}`);
    });
  }

  function onRecipientChange(value: string) {
    if (!value) {
      setRecipient(null);
      return;
    }
    const [kind, id] = value.split(":", 2);
    if ((kind === "client" || kind === "lead") && id) {
      setRecipient({ kind, id });
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card>
          <CardContent className="pt-6">
            <p className="mb-4 text-xs text-muted-foreground">
              Los campos marcados con <span className="text-destructive">*</span> son obligatorios.
              El resto puedes dejarlos en blanco y completarlos más tarde.
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormRow
                label="Destinatario"
                htmlFor="recipient"
                required
                hint="Cliente existente o lead. Si es lead, le pediremos sus datos fiscales al aceptar."
              >
                <Select
                  id="recipient"
                  value={recipientValue}
                  onChange={(e) => onRecipientChange(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    — Selecciona destinatario —
                  </option>
                  {clients.length > 0 ? (
                    <optgroup label="Clientes">
                      {clients.map((c) => (
                        <option key={`client-${c.id}`} value={`client:${c.id}`}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {leads.length > 0 ? (
                    <optgroup label="Leads abiertos">
                      {leads.map((l) => (
                        <option key={`lead-${l.id}`} value={`lead:${l.id}`}>
                          {l.company ? `${l.name} · ${l.company}` : l.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
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
            <LineItemsTable items={items} onChange={setItems} showBillingCycle />
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

        <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
          <FormFeedback state={feedback.state} pendingLabel="Creando…" />
          <Button asChild variant="ghost" size="sm">
            <Link href="/proposals">Cancelar</Link>
          </Button>
          <SubmitButton loading={pending} disabled={!canSubmit} pendingLabel="Creando…">
            Crear propuesta
          </SubmitButton>
        </div>
      </form>

      <Dialog
        open={!!pendingLeadMove}
        onOpenChange={(v) => {
          if (!v && pendingLeadMove) {
            router.push(`/proposals/${pendingLeadMove.proposalId}`);
            setPendingLeadMove(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Mover lead a Presupuestado?</DialogTitle>
            <DialogDescription>
              Has creado una propuesta para <strong>{pendingLeadMove?.leadName}</strong>.{" "}
              ¿Quieres mover el lead a <strong>Presupuestado</strong> para reflejar el estado actual?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!pendingLeadMove) return;
                router.push(`/proposals/${pendingLeadMove.proposalId}`);
                setPendingLeadMove(null);
              }}
            >
              No por ahora
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                if (!pendingLeadMove) return;
                const { leadId, proposalId } = pendingLeadMove;
                setPendingLeadMove(null);
                await updateLeadStatus({ leadId, status: "quoted" });
                router.push(`/proposals/${proposalId}`);
              }}
            >
              Sí, mover
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
