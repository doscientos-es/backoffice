"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { MemberLabel } from "@/components/ui/member-avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { leadDisplayName } from "@/lib/leads/utils";
import type { MemberOption } from "@/lib/members/queries";
import { LEAD_STATUS } from "@/lib/status";
import { formatEUR, relativeTime } from "@/lib/utils";
import {
  ArrowUpRight,
  Building2,
  Clock,
  Hand,
  Loader2,
  Mail,
  Phone,
  Timer,
  Trash2,
  TriangleAlert,
  UserRound,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { LeadEditDialog } from "./[id]/lead-edit-dialog";
import { assignLeadOwner, claimLead } from "./actions";
import { QCallDialog, QEmailDialog, QNoteDialog } from "./lead-quick-action-dialogs";
import type { KanbanLead } from "./leads-kanban";

const INTERACTION_LABEL: Record<string, string> = {
  email_sent: "Email enviado",
  email_received: "Email recibido",
  call: "Llamada",
  meeting: "Reunión",
  note: "Nota",
  owner_change: "Responsable cambiado",
  status_change: "Cambio de estado",
};

export function LeadQuickView({
  lead,
  canEdit = false,
  members = [],
  onDeleteAction,
  onCloseAction,
}: {
  lead: KanbanLead | null;
  canEdit?: boolean;
  members?: MemberOption[];
  /** Optimistically removes the lead from the board and runs the delete. Optional — falls back to router.refresh(). */
  onDeleteAction?: (id: string) => void;
  onCloseAction: () => void;
}) {
  return (
    <Drawer open={!!lead} onOpenChange={(v) => !v && onCloseAction()} direction="right">
      <DrawerContent className="sm:max-w-sm">
        {lead ? (
          <ErrorBoundary>
            <Body lead={lead} canEdit={canEdit} members={members} onDeleteAction={onDeleteAction} />
          </ErrorBoundary>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

function Body({
  lead,
  canEdit,
  members,
  onDeleteAction,
}: {
  lead: KanbanLead;
  canEdit: boolean;
  members: MemberOption[];
  onDeleteAction?: (id: string) => void;
}) {
  const hasEstimated = lead.estimated_value != null && lead.estimated_value > 0;
  const displayName = leadDisplayName(lead);
  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto_auto]">
      <DrawerHeader className="flex flex-row items-start justify-between gap-2 border-b border-border">
        <div className="flex flex-col gap-1">
          <DrawerTitle>{displayName}</DrawerTitle>
          <DrawerDescription className="flex items-center gap-1.5">
            <StatusBadge meta={LEAD_STATUS} value={lead.status} />
            <span className="text-[11px] tabular-nums">{relativeTime(lead.updated_at)}</span>
          </DrawerDescription>
        </div>
        <DrawerClose asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Cerrar">
            <X className="size-4" />
          </Button>
        </DrawerClose>
      </DrawerHeader>

      <div className="flex flex-col gap-4 overflow-y-auto h-full flex-1 p-4 scroll-fade no-scrollbar">
        {(lead.status === "lost" || lead.status === "not_interested") && lead.lost_reason && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-xs">
            <TriangleAlert className="size-3.5 shrink-0 mt-0.5 text-destructive" />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-semibold text-destructive">
                {lead.status === "lost" ? "Motivo de pérdida" : "Motivo de no interés"}
              </span>
              <span className="text-foreground">{lead.lost_reason}</span>
            </div>
          </div>
        )}
        <section className="flex flex-col gap-1.5 text-xs">
          {lead.company && <Row icon={<Building2 className="size-3.5" />}>{lead.company}</Row>}
          {lead.email && (
            <Row icon={<Mail className="size-3.5" />} href={`mailto:${lead.email}`}>
              {lead.email}
            </Row>
          )}
          {lead.phone && (
            <Row icon={<Phone className="size-3.5" />} href={`tel:${lead.phone}`}>
              {lead.phone}
            </Row>
          )}
          {hasEstimated && (
            <Row icon={<Wallet className="size-3.5" />}>
              <span className="tabular-nums">{formatEUR(lead.estimated_value as number)}</span>
            </Row>
          )}
          {lead.score != null && (
            <Row icon={<Timer className="size-3.5" />}>
              <span className="tabular-nums">Score {lead.score}/100</span>
            </Row>
          )}
          <Row icon={<UserRound className="size-3.5" />}>
            {canEdit && !lead.assignee ? (
              <AssignWidget leadId={lead.id} members={members} />
            ) : (
              <MemberLabel member={lead.assignee} size="sm" />
            )}
          </Row>
          <Row icon={<Timer className="size-3.5" />}>
            {lead.first_contacted_at ? (
              <span className="tabular-nums">
                Primer contacto {relativeTime(lead.first_contacted_at)}
              </span>
            ) : (
              <span className="text-muted-foreground">Sin contactar</span>
            )}
          </Row>
        </section>
        {(lead.company_size || lead.solution_type || lead.urgency) && (
          <section className="flex flex-col gap-1.5 text-xs">
            <Heading>Cualificación</Heading>
            {lead.company_size && (
              <Row icon={<Users className="size-3.5" />}>{lead.company_size}</Row>
            )}
            {lead.solution_type && (
              <Row icon={<Wrench className="size-3.5" />}>{lead.solution_type}</Row>
            )}
            {lead.urgency && <Row icon={<Clock className="size-3.5" />}>{lead.urgency}</Row>}
          </section>
        )}
        {(lead.landing_path ||
          lead.landing_ref ||
          lead.landing_subject ||
          lead.conversion_step) && (
          <section className="flex flex-col gap-1.5 text-xs">
            <Heading>AtribuciÃ³n</Heading>
            {lead.conversion_step && (
              <Row icon={<ArrowUpRight className="size-3.5" />}>{lead.conversion_step}</Row>
            )}
            {lead.landing_path && (
              <Row icon={<ArrowUpRight className="size-3.5" />}>{lead.landing_path}</Row>
            )}
            {lead.landing_ref && (
              <Row icon={<ArrowUpRight className="size-3.5" />}>{lead.landing_ref}</Row>
            )}
            {lead.landing_subject && (
              <Row icon={<ArrowUpRight className="size-3.5" />}>{lead.landing_subject}</Row>
            )}
          </section>
        )}
        {lead.notes && (
          <section className="flex flex-col gap-1.5">
            <Heading>Notas</Heading>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
              {lead.notes}
            </p>
          </section>
        )}
        {lead.ai_summary && (
          <section className="flex flex-col gap-1.5">
            <Heading>Resumen IA</Heading>
            <p className="text-xs leading-relaxed text-foreground">{lead.ai_summary}</p>
          </section>
        )}
        <Interactions interactions={lead.recent_interactions} />
      </div>

      <div className="shrink-0 border-t border-border px-4 py-3">
        <QuickActions
          leadId={lead.id}
          leadName={displayName}
          leadPhone={lead.phone}
          leadEmail={lead.email}
        />
      </div>

      <footer className="flex items-center gap-2 border-t border-border p-3">
        {canEdit && (
          <>
            {onDeleteAction && (
              <DeleteLeadButton
                leadId={lead.id}
                leadName={displayName}
                onConfirmAction={onDeleteAction}
              />
            )}
            <LeadEditDialog
              members={members}
              lead={{
                id: lead.id,
                name: lead.name,
                alias: lead.alias,
                company: lead.company,
                email: lead.email,
                phone: lead.phone,
                source: lead.source,
                notes: lead.notes,
                estimated_value: lead.estimated_value,
                company_size: lead.company_size ?? null,
                solution_type: lead.solution_type ?? null,
                urgency: lead.urgency ?? null,
                assigned_to: lead.assignee?.id ?? null,
              }}
            />
          </>
        )}
        <Button asChild className="flex-1" size="sm" variant="outline">
          <Link href={`/leads/${lead.id}`}>
            Ver detalle completo
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </footer>
    </div>
  );
}

function DeleteLeadButton({
  leadId,
  leadName,
  onConfirmAction,
}: {
  leadId: string;
  leadName: string;
  /** Triggers the optimistic removal + delete in the parent board. */
  onConfirmAction: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  function onConfirm() {
    setOpen(false);
    onConfirmAction(leadId);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Eliminar lead"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar lead</DialogTitle>
          <DialogDescription>
            ¿Eliminar <strong>{leadName}</strong>? Esta acción es reversible desde la base de datos.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            Eliminar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function Row({ icon, href, children }: { icon: ReactNode; href?: string; children: ReactNode }) {
  const inner = (
    <>
      <span className="text-muted-foreground">{icon}</span>
      <span className="truncate">{children}</span>
    </>
  );
  return href ? (
    <a href={href} className="flex items-center gap-2 hover:text-primary">
      {inner}
    </a>
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
                <span className="font-medium text-foreground">
                  {INTERACTION_LABEL[i.type] ?? i.type}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {relativeTime(i.created_at)}
                </span>
              </div>
              {i.subject && (
                <p className="line-clamp-2 text-[11px] text-muted-foreground">{i.subject}</p>
              )}
              {i.performer && (
                <MemberLabel
                  member={i.performer}
                  size="sm"
                  className="text-[11px] text-muted-foreground"
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Assign Widget ───────────────────────────────────────────────────────────

function AssignWidget({ leadId, members }: { leadId: string; members: MemberOption[] }) {
  const router = useRouter();
  const [claimPending, startClaim] = useTransition();
  const [assignPending, startAssign] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isPending = claimPending || assignPending;

  const handleClaim = () => {
    setError(null);
    startClaim(async () => {
      const res = await claimLead({ leadId });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  };

  const handleAssign = (assigneeId: string) => {
    if (!assigneeId) return;
    setError(null);
    startAssign(async () => {
      const res = await assignLeadOwner({ leadId, assigneeId });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  };

  return (
    <div className="flex flex-col gap-1.5 w-full min-w-0">
      <Button
        type="button"
        variant="outline"
        size="xs"
        disabled={isPending}
        onClick={handleClaim}
        className="w-full justify-start gap-1.5"
      >
        {claimPending ? <Loader2 className="size-3 animate-spin" /> : <Hand className="size-3" />}
        Asignármelo
      </Button>
      <select
        disabled={isPending}
        className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        value=""
        onChange={(e) => handleAssign(e.target.value)}
      >
        <option value="" disabled>
          Asignar a…
        </option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

// ─── Quick Actions (inline in drawer) ────────────────────────────────────────

function QuickActions({
  leadId,
  leadName,
  leadPhone,
  leadEmail,
}: {
  leadId: string;
  leadName: string;
  leadPhone: string | null;
  leadEmail: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Acciones rápidas
      </p>
      <div className="flex flex-col gap-1.5">
        <QCallDialog leadId={leadId} leadName={leadName} leadPhone={leadPhone} />
        <QEmailDialog leadId={leadId} leadEmail={leadEmail} />
        <QNoteDialog leadId={leadId} />
      </div>
    </div>
  );
}
