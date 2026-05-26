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
import { formatEUR, relativeTime } from "@/lib/utils";
import { ArrowUpRight, Building2, Mail, Wallet, X } from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";
import { LeadEditDialog } from "./[id]/lead-edit-dialog";
import { QCallDialog, QEmailDialog, QNoteDialog } from "./lead-quick-action-dialogs";
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

export function LeadQuickView({
  lead,
  canEdit = false,
  onCloseAction,
}: {
  lead: KanbanLead | null;
  canEdit?: boolean;
  onCloseAction: () => void;
}) {
  return (
    <Drawer open={!!lead} onOpenChange={(v) => !v && onCloseAction()} direction="right">
      <DrawerContent className="sm:max-w-sm">
        {lead ? <Body lead={lead} canEdit={canEdit} /> : null}
      </DrawerContent>
    </Drawer>
  );
}

function Body({ lead, canEdit }: { lead: KanbanLead; canEdit: boolean }) {
  const hasEstimated = lead.estimated_value != null && lead.estimated_value > 0;
  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto_auto]">
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

      <div className="flex flex-col gap-4 overflow-y-auto h-full flex-1 p-4">
        <section className="flex flex-col gap-1.5 text-xs">
          {lead.company && <Row icon={<Building2 className="size-3.5" />}>{lead.company}</Row>}
          {lead.email && <Row icon={<Mail className="size-3.5" />} href={`mailto:${lead.email}`}>{lead.email}</Row>}
          {lead.phone && <Row icon={<Phone className="size-3.5" />} href={`tel:${lead.phone}`}>{lead.phone}</Row>}
          {hasEstimated && (
            <Row icon={<Wallet className="size-3.5" />}>
              <span className="tabular-nums">{formatEUR(lead.estimated_value as number)}</span>
            </Row>
          )}
        </section>
        {lead.ai_summary && (
          <section className="flex flex-col gap-1.5">
            <Heading>Resumen IA</Heading>
            <p className="text-xs leading-relaxed text-foreground">{lead.ai_summary}</p>
          </section>
        )}
        <Interactions interactions={lead.recent_interactions} />
      </div>

      <div className="shrink-0 border-t border-border px-4 py-3">
        <QuickActions leadId={lead.id} leadPhone={lead.phone} leadEmail={lead.email} />
      </div>

      <footer className="flex items-center gap-2 border-t border-border p-3">
        {canEdit && (
          <LeadEditDialog
            lead={{
              id: lead.id,
              name: lead.name,
              company: lead.company,
              email: lead.email,
              phone: lead.phone,
              source: lead.source,
              notes: lead.notes,
              estimated_value: lead.estimated_value,
            }}
          />
        )}
        <Button asChild className="flex-1" size="sm" variant="outline">
          <Link href={`/leads/${lead.id}`}>Ver detalle completo<ArrowUpRight className="size-3.5" /></Link>
        </Button>
      </footer>
    </div>
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

// ─── Quick Actions (inline in drawer) ────────────────────────────────────────

function QuickActions({
  leadId,
  leadPhone,
  leadEmail,
}: {
  leadId: string;
  leadPhone: string | null;
  leadEmail: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Acciones rápidas
      </p>
      <div className="flex flex-col gap-1.5">
        <QCallDialog leadId={leadId} leadPhone={leadPhone} />
        <QEmailDialog leadId={leadId} leadEmail={leadEmail} />
        <QNoteDialog leadId={leadId} />
      </div>
    </div>
  );
}

function QEmailDialog_LEGACY({ leadId, leadEmail }: { leadId: string; leadEmail: string | null }) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"incoming" | "outgoing">("outgoing");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const feedback = useFormFeedback();
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    feedback.setPending();
    const res = await logLeadEmail({
      leadId,
      direction,
      subject,
      bodyHtml: body.trim() || undefined,
      counterparty: leadEmail ?? undefined,
    });
    if (!res.ok) return feedback.setError(res.error);
    feedback.setSuccess("Registrado");
    setSubject("");
    setBody("");
    router.refresh();
    setTimeout(() => setOpen(false), 400);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2">
          <Mail className="size-3.5 text-muted-foreground" />
          Registrar email
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar email</DialogTitle>
          <DialogDescription>Para emails enviados o recibidos fuera de la app.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`qv-email-dir-${leadId}`} className="text-xs font-medium">Dirección</Label>
            <Select id={`qv-email-dir-${leadId}`} value={direction} onChange={(e) => setDirection(e.target.value as "incoming" | "outgoing")}>
              <option value="outgoing">Enviado</option>
              <option value="incoming">Recibido</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`qv-email-subj-${leadId}`} className="text-xs font-medium">Asunto <span className="text-destructive">*</span></Label>
            <Input id={`qv-email-subj-${leadId}`} required maxLength={300} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Asunto del email" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`qv-email-body-${leadId}`} className="text-xs font-medium">
              Cuerpo <span className="text-muted-foreground/60">(opcional, mejora el resumen IA)</span>
            </Label>
            <Textarea
              id={`qv-email-body-${leadId}`}
              rows={5}
              maxLength={50000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Pega o resume el contenido del email…"
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
            <SubmitButton loading={feedback.pending}>Registrar</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QNoteDialog({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const feedback = useFormFeedback();
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    feedback.setPending();
    const res = await logLeadNote({ leadId, content });
    if (!res.ok) return feedback.setError(res.error);
    feedback.setSuccess("Nota guardada");
    setContent("");
    router.refresh();
    setTimeout(() => setOpen(false), 400);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2">
          <NotebookPen className="size-3.5 text-muted-foreground" />
          Añadir nota
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Añadir nota</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Textarea rows={4} required value={content} onChange={(e) => setContent(e.target.value)} placeholder="Observaciones, contexto, próximos pasos…" />
          <div className="flex items-center justify-end gap-3">
            <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
            <SubmitButton loading={feedback.pending}>Guardar nota</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
