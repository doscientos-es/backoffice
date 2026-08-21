import {
  ArrowRight as ArrowRight,
  BriefcaseBusiness as BriefcaseBusiness,
  SquareCheck as CheckSquare2,
  CircleDollarSign as CircleDollarSign,
  FileText as FileSignature,
  Mail as Mail,
  Receipt as ReceiptText,
  Sparkle as Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { groupResendInteractions, interactionDate } from "@/lib/leads/interaction-utils";
import type {
  LeadDetailInteraction,
  LeadRelatedInvoice,
  LeadRelatedProject,
  LeadRelatedProposal,
  LeadRelatedTask,
} from "@/lib/leads/types";
import { formatEUR, relativeTime } from "@/lib/utils";

type TimelineEvent = {
  id: string;
  date: string;
  title: string;
  detail?: string | null;
  href?: string;
  icon: typeof Mail;
  color: string;
};

function interactionLabel(type: string): string {
  const labels: Record<string, string> = {
    email_sent: "Email enviado",
    email_received: "Email recibido",
    email_delivered: "Email entregado",
    email_opened: "Email abierto",
    email_clicked: "Email con clic",
    email_bounced: "Email rebotado",
    email_complained: "Email marcado como spam",
    email_scheduled: "Email programado",
    email_delivery_delayed: "Entrega de email retrasada",
    email_failed: "Error al enviar el email",
    email_suppressed: "Email suprimido",
    call: "Llamada registrada",
    meeting: "Reunión registrada",
    note: "Nota añadida",
    status_change: "Estado actualizado",
  };
  return labels[type] ?? type.replaceAll("_", " ");
}

function eventList({
  interactions,
  proposals,
  invoices,
  tasks,
}: {
  interactions: LeadDetailInteraction[];
  proposals: LeadRelatedProposal[];
  invoices: LeadRelatedInvoice[];
  tasks: LeadRelatedTask[];
}): TimelineEvent[] {
  const interactionEvents = groupResendInteractions(interactions).map(
    ({ interaction: item, count }) => ({
      id: `interaction-${item.id}`,
      date: interactionDate(item),
      title: interactionLabel(item.type),
      detail: [
        item.subject ??
          item.body
            ?.replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim() ??
          null,
        count > 1 ? `${count} eventos` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      icon: Mail,
      color: "text-blue-500 bg-blue-500/10",
    }),
  );
  const proposalEvents = proposals.flatMap((item) => {
    const date = item.responded_at ?? item.viewed_at ?? item.sent_at;
    if (!date) return [];
    return [
      {
        id: `proposal-${item.id}`,
        date,
        title: item.status === "accepted" ? "Propuesta aceptada" : "Propuesta en seguimiento",
        detail: [
          item.number ?? "Propuesta",
          item.total != null ? formatEUR(Number(item.total)) : null,
        ]
          .filter(Boolean)
          .join(" · "),
        href: `/proposals/${item.id}`,
        icon: FileSignature,
        color: "text-violet-500 bg-violet-500/10",
      },
    ];
  });
  const invoiceEvents = invoices.map((item) => ({
    id: `invoice-${item.id}`,
    date: item.issue_date ?? new Date().toISOString(),
    title: item.status === "overdue" ? "Factura vencida" : "Factura emitida",
    detail: [
      item.full_number ?? "Factura",
      item.total != null ? formatEUR(Number(item.total)) : null,
    ]
      .filter(Boolean)
      .join(" · "),
    href: `/invoices/${item.id}`,
    icon: ReceiptText,
    color:
      item.status === "overdue"
        ? "text-rose-500 bg-rose-500/10"
        : "text-emerald-500 bg-emerald-500/10",
  }));
  const taskEvents = tasks.map((item) => ({
    id: `task-${item.id}`,
    date: item.due_date ?? new Date().toISOString(),
    title: item.status === "done" ? "Tarea completada" : "Tarea pendiente",
    detail: item.title,
    href: `/tasks/${item.id}`,
    icon: CheckSquare2,
    color: "text-amber-500 bg-amber-500/10",
  }));
  return [...interactionEvents, ...proposalEvents, ...invoiceEvents, ...taskEvents]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);
}

type NextMove = {
  label: string;
  hint: string;
  href: string;
  icon: typeof Mail;
  tone: string;
};

function nextMove({
  leadId,
  leadStatus,
  proposals,
  projects,
  invoices,
}: {
  leadId: string;
  leadStatus: string;
  proposals: LeadRelatedProposal[];
  projects: LeadRelatedProject[];
  invoices: LeadRelatedInvoice[];
}): NextMove {
  const overdueInvoice = invoices.find((item) => item.status === "overdue");
  if (overdueInvoice) {
    return {
      label: "Reclamar el cobro pendiente",
      hint: `La factura ${overdueInvoice.full_number ?? "vencida"} necesita seguimiento.`,
      href: `/invoices/${overdueInvoice.id}`,
      icon: ReceiptText,
      tone: "border-rose-500/20 bg-rose-500/[0.06] text-rose-700 dark:text-rose-300",
    };
  }

  const draftProposal = proposals.find((item) => item.status === "draft");
  if (draftProposal) {
    return {
      label: "Completar y enviar la propuesta",
      hint: `${draftProposal.number ?? draftProposal.title ?? "La propuesta"} está en borrador.`,
      href: `/proposals/${draftProposal.id}`,
      icon: FileSignature,
      tone: "border-violet-500/20 bg-violet-500/[0.06] text-violet-700 dark:text-violet-300",
    };
  }

  const openProposal = proposals.find((item) => ["sent", "viewed"].includes(item.status ?? ""));
  if (openProposal) {
    return {
      label: "Hacer seguimiento de la propuesta",
      hint: `${openProposal.number ?? "La propuesta"} está en circulación.`,
      href: `/proposals/${openProposal.id}`,
      icon: FileSignature,
      tone: "border-violet-500/20 bg-violet-500/[0.06] text-violet-700 dark:text-violet-300",
    };
  }

  const activeProject = projects.find((item) => item.status === "active");
  if (activeProject) {
    return {
      label: "Mantener al cliente al día",
      hint: `${activeProject.name} está en ejecución.`,
      href: `/projects/${activeProject.id}`,
      icon: BriefcaseBusiness,
      tone: "border-amber-500/20 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300",
    };
  }

  const acceptedProposal = proposals.find((item) => item.status === "accepted");
  if (acceptedProposal) {
    return {
      label: "Preparar la entrega acordada",
      hint: `${acceptedProposal.number ?? acceptedProposal.title ?? "La propuesta"} ya está aceptada.`,
      href: `/proposals/${acceptedProposal.id}`,
      icon: FileSignature,
      tone: "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300",
    };
  }

  return {
    label: leadStatus === "new" ? "Contactar cuanto antes" : "Crear la siguiente oportunidad",
    hint: "El flujo no tiene una transición abierta todavía.",
    href: proposals.length ? `/proposals/new?lead_id=${leadId}` : `/leads/${leadId}?feedback=call`,
    icon: CircleDollarSign,
    tone: "border-primary/20 bg-primary/[0.06] text-primary",
  };
}

export function Lead360Timeline({
  leadId,
  leadStatus,
  interactions,
  proposals,
  projects,
  invoices,
  tasks,
}: {
  leadId: string;
  leadStatus: string;
  interactions: LeadDetailInteraction[];
  proposals: LeadRelatedProposal[];
  projects: LeadRelatedProject[];
  invoices: LeadRelatedInvoice[];
  tasks: LeadRelatedTask[];
}) {
  const events = eventList({ interactions, proposals, invoices, tasks });
  const next = nextMove({ leadId, leadStatus, proposals, projects, invoices });
  const NextIcon = next.icon;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/70 bg-muted/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-primary" />
                Journey 360º
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Todo lo que ha pasado alrededor de esta oportunidad.
              </p>
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {events.length} señales
            </span>
          </div>
        </CardHeader>
        <CardContent className="px-5 py-5">
          {events.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              Aún no hay actividad cruzada registrada.
            </p>
          ) : (
            <ol className="relative ml-2 border-l border-border">
              {events.map((event) => {
                const Icon = event.icon;
                const content = (
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium capitalize">{event.title}</p>
                      {event.detail ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {event.detail}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {relativeTime(event.date)}
                    </span>
                  </div>
                );
                return (
                  <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
                    <span
                      className={`-ml-3.5 flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ring-card ${event.color}`}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    {event.href ? (
                      <Link href={event.href} className="min-w-0 flex-1 hover:opacity-75">
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card className={`border ${next.tone}`}>
        <CardHeader>
          <CardTitle className="text-base">Siguiente movimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex size-10 items-center justify-center rounded-xl bg-background/70 shadow-sm">
            <NextIcon className="size-5" />
          </div>
          <h3 className="mt-4 text-base font-semibold leading-snug">{next.label}</h3>
          <p className="mt-2 text-sm opacity-80">{next.hint}</p>
          <Link
            href={next.href}
            className="mt-5 inline-flex items-center gap-2 text-sm font-medium hover:underline"
          >
            Abrir contexto <ArrowRight className="size-4" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
