"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { relativeTime } from "@/lib/utils";
import { ArrowUpRight, Building2, Mail, Phone, X } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { updateLeadEstimatedValue } from "./actions";
import type { KanbanLead } from "./leads-kanban";

const STATUS_LABEL: Record<KanbanLead["status"], string> = {
  new: "Nuevo",
  qualifying: "Cualificando",
  quoted: "Presupuestado",
  won: "Ganado",
  lost: "Perdido",
  archived: "Archivado",
};

const STATUS_VARIANT = {
  new: "info",
  qualifying: "warning",
  quoted: "warning",
  won: "success",
  lost: "danger",
  archived: "neutral",
} as const;

const INTERACTION_LABEL: Record<string, string> = {
  email_sent: "Email enviado",
  email_received: "Email recibido",
  call: "Llamada",
  meeting: "Reunión",
  note: "Nota",
};

export function LeadQuickView({ lead, onClose }: { lead: KanbanLead | null; onClose: () => void }) {
  return (
    <Drawer open={!!lead} onOpenChange={(v) => !v && onClose()} direction="right">
      <DrawerContent className="sm:max-w-sm">{lead ? <Body lead={lead} /> : null}</DrawerContent>
    </Drawer>
  );
}

function Body({ lead }: { lead: KanbanLead }) {
  return (
    <>
      <DrawerHeader className="flex flex-row items-start justify-between gap-2 border-b border-border">
        <div className="flex flex-col gap-1">
          <DrawerTitle>{lead.name}</DrawerTitle>
          <DrawerDescription className="flex items-center gap-1.5">
            <Badge variant={STATUS_VARIANT[lead.status]}>{STATUS_LABEL[lead.status]}</Badge>
            <span className="text-[11px] tabular-nums">{relativeTime(lead.updated_at)}</span>
          </DrawerDescription>
        </div>
        <DrawerClose asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Cerrar"><X className="size-4" /></Button>
        </DrawerClose>
      </DrawerHeader>

      <div className="flex flex-col gap-4 overflow-y-auto p-4">
        <section className="flex flex-col gap-1.5 text-xs">
          {lead.company && <Row icon={<Building2 className="size-3.5" />}>{lead.company}</Row>}
          {lead.email && <Row icon={<Mail className="size-3.5" />} href={`mailto:${lead.email}`}>{lead.email}</Row>}
          {lead.phone && <Row icon={<Phone className="size-3.5" />} href={`tel:${lead.phone}`}>{lead.phone}</Row>}
        </section>
        <ValueEditor leadId={lead.id} initial={lead.estimated_value} />
        {lead.ai_summary && (
          <section className="flex flex-col gap-1.5">
            <Heading>Resumen IA</Heading>
            <p className="text-xs leading-relaxed text-foreground">{lead.ai_summary}</p>
          </section>
        )}
        <Interactions interactions={lead.recent_interactions} />
      </div>

      <div className="mt-auto border-t border-border p-3">
        <Button asChild className="w-full" size="sm" variant="outline">
          <Link href={`/leads/${lead.id}`}>Ver detalle completo<ArrowUpRight className="size-3.5" /></Link>
        </Button>
      </div>
    </>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>;
}

function Row({ icon, href, children }: { icon: ReactNode; href?: string; children: ReactNode }) {
  const inner = (<><span className="text-muted-foreground">{icon}</span><span className="truncate">{children}</span></>);
  return href ? (
    <a href={href} className="flex items-center gap-2 hover:text-primary">{inner}</a>
  ) : (
    <div className="flex items-center gap-2">{inner}</div>
  );
}

function ValueEditor({ leadId, initial }: { leadId: string; initial: number | null }) {
  const [value, setValue] = useState(initial != null ? String(initial) : "");
  const feedback = useFormFeedback();
  useEffect(() => {
    setValue(initial != null ? String(initial) : "");
  }, [initial, leadId]);

  const commit = async () => {
    const trimmed = value.trim();
    const num = trimmed === "" ? null : Number.parseFloat(trimmed);
    if (num != null && !Number.isFinite(num)) return feedback.setError("Valor no válido");
    if (num === initial || (num == null && initial == null)) return;
    feedback.setPending();
    const res = await updateLeadEstimatedValue({ leadId, value: num });
    if (!res.ok) feedback.setError(res.error);
    else feedback.setSuccess("Guardado");
  };

  return (
    <section className="flex flex-col gap-1.5">
      <Label htmlFor={`qv-value-${leadId}`} className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Valor estimado (€)
      </Label>
      <div className="flex items-center gap-2">
        <Input id={`qv-value-${leadId}`} type="number" inputMode="decimal" min={0} step="0.01"
          value={value} onChange={(e) => setValue(e.target.value)} onBlur={commit}
          placeholder="0,00" className="tabular-nums" />
        <FormFeedback state={feedback.state} pendingLabel="…" />
      </div>
    </section>
  );
}

function Interactions({ interactions }: { interactions: KanbanLead["recent_interactions"] }) {
  return (
    <section className="flex flex-col gap-1.5">
      <Heading>Últimas interacciones</Heading>
      {interactions.length === 0 ? (
        <p className="text-xs text-muted-foreground/80">Sin interacciones registradas.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {interactions.slice(0, 3).map((i) => (
            <li key={i.id} className="flex flex-col gap-0.5 rounded-md bg-muted/30 p-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-foreground">{INTERACTION_LABEL[i.type] ?? i.type}</span>
                <span className="text-muted-foreground tabular-nums">{relativeTime(i.created_at)}</span>
              </div>
              {i.subject && <p className="line-clamp-2 text-[11px] text-muted-foreground">{i.subject}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
