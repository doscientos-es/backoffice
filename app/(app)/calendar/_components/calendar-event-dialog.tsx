"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CALENDAR_LAYER_COLORS,
  CALENDAR_LAYER_LABELS,
  type CalendarEvent,
} from "@/lib/calendar/types";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowUpRight,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  Layers,
  MapPin,
  Tag,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";

type Props = {
  event: CalendarEvent | null;
  onClose: () => void;
};

export function CalendarEventDialog({ event, onClose }: Props) {
  return (
    <Dialog open={!!event} onOpenChange={(o) => !o && onClose()}>
      {event && <EventDialogContent event={event} onClose={onClose} />}
    </Dialog>
  );
}

function EventDialogContent({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
  const colors = CALENDAR_LAYER_COLORS[event.kind];
  const label = CALENDAR_LAYER_LABELS[event.kind];

  const startDate = parseISO(event.start);
  const endDate = parseISO(event.end);
  const sameDay = event.start.slice(0, 10) === event.end.slice(0, 10);

  const dateStr = event.allDay
    ? format(startDate, "EEEE, d MMMM yyyy", { locale: es })
    : format(startDate, "EEEE, d MMMM yyyy · HH:mm", { locale: es }) +
      (!sameDay ? ` — ${format(endDate, "d MMM · HH:mm", { locale: es })}` : "");

  return (
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <div className="flex items-start gap-2.5 pr-6">
          <span className={cn("mt-0.5 h-3 w-3 shrink-0 rounded-full", colors.dot)} />
          <DialogTitle
            className={cn("text-base leading-snug", event.done && "line-through opacity-60")}
          >
            {event.title}
          </DialogTitle>
        </div>
      </DialogHeader>

      <div className="flex flex-col gap-2.5 text-sm">
        {/* Kind badge */}
        <Row icon={<Tag className="size-3.5" />}>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
              colors.bg,
              colors.text,
            )}
          >
            {label}
          </span>
          {event.done && <CheckCircle2 className="ml-1 size-3.5 text-muted-foreground" />}
          {!event.done && <Circle className="ml-1 size-3.5 text-muted-foreground" />}
        </Row>

        {/* Date */}
        <Row icon={<CalendarDays className="size-3.5" />}>
          <span className="text-foreground capitalize">{dateStr}</span>
        </Row>

        {/* Time (timed events only) */}
        {!event.allDay && (
          <Row icon={<Clock className="size-3.5" />}>
            <span>
              {format(startDate, "HH:mm")}
              {!sameDay ? ` — ${format(endDate, "HH:mm d MMM")}` : ""}
            </span>
          </Row>
        )}

        {/* Member */}
        {event.memberName && (
          <Row icon={<User className="size-3.5" />}>
            <span>{event.memberName}</span>
          </Row>
        )}

        {/* Location (events) */}
        {event.meta.location && (
          <Row icon={<MapPin className="size-3.5" />}>
            <span className="text-foreground">{event.meta.location}</span>
          </Row>
        )}

        {/* Attendees (events) */}
        {event.meta.attendees && event.meta.attendees.length > 0 && (
          <Row icon={<Users className="size-3.5" />}>
            <span>{event.meta.attendees.join(", ")}</span>
          </Row>
        )}

        {/* Project */}
        {event.meta.projectName && (
          <Row icon={<Layers className="size-3.5" />}>
            {event.meta.projectId ? (
              <Link
                href={`/projects/${event.meta.projectId}`}
                onClick={onClose}
                className="text-foreground underline-offset-2 hover:underline"
              >
                {event.meta.projectName}
                <ArrowUpRight className="ml-0.5 inline size-3 opacity-60" />
              </Link>
            ) : (
              <span className="text-foreground">{event.meta.projectName}</span>
            )}
          </Row>
        )}

        {/* Lead */}
        {event.meta.leadName && (
          <Row icon={<User className="size-3.5" />}>
            {event.meta.leadId ? (
              <Link
                href={`/leads/${event.meta.leadId}`}
                onClick={onClose}
                className="text-foreground underline-offset-2 hover:underline"
              >
                {event.meta.leadName}
                <ArrowUpRight className="ml-0.5 inline size-3 opacity-60" />
              </Link>
            ) : (
              <span className="text-foreground">{event.meta.leadName}</span>
            )}
          </Row>
        )}

        {/* Client */}
        {event.meta.clientName && !event.meta.leadName && (
          <Row icon={<Briefcase className="size-3.5" />}>
            {event.meta.clientId ? (
              <Link
                href={`/clients/${event.meta.clientId}`}
                onClick={onClose}
                className="text-foreground underline-offset-2 hover:underline"
              >
                {event.meta.clientName}
                <ArrowUpRight className="ml-0.5 inline size-3 opacity-60" />
              </Link>
            ) : (
              <span className="text-foreground">{event.meta.clientName}</span>
            )}
          </Row>
        )}

        {/* Description / notes */}
        {event.meta.description && (
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
            {event.meta.description}
          </p>
        )}

        {/* Amount */}
        {event.meta.amount != null && (
          <Row icon={<span className="size-3.5 text-[10px] leading-none">€</span>}>
            <span className="font-medium tabular-nums">
              {event.meta.amount.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
            </span>
          </Row>
        )}

        {/* Status */}
        {event.meta.status && (
          <Row icon={<span className="size-3.5 text-[10px] leading-none">◉</span>}>
            <span className="capitalize text-muted-foreground">{event.meta.status}</span>
          </Row>
        )}
      </div>

      {/* Footer */}
      <div className="-mx-4 -mb-4 flex items-center justify-end gap-2 rounded-b-xl border-t bg-muted/50 px-4 py-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cerrar
        </Button>
        {event.meta.meetUrl && (
          <Button asChild size="sm" variant="outline" onClick={onClose}>
            <a href={event.meta.meetUrl} target="_blank" rel="noopener noreferrer">
              Unirse
              <ArrowUpRight className="ml-1 size-3.5" />
            </a>
          </Button>
        )}
        {event.meta.htmlLink && !event.meta.meetUrl && (
          <Button asChild size="sm" variant="outline" onClick={onClose}>
            <a href={event.meta.htmlLink} target="_blank" rel="noopener noreferrer">
              Ver en Google
              <ArrowUpRight className="ml-1 size-3.5" />
            </a>
          </Button>
        )}
        {event.meta.leadId && (
          <Button asChild size="sm" variant="outline" onClick={onClose}>
            <Link href={`/leads/${event.meta.leadId}`}>
              Ver lead
              <ArrowUpRight className="ml-1 size-3.5" />
            </Link>
          </Button>
        )}
        {event.meta.projectId && (
          <Button asChild size="sm" onClick={onClose}>
            <Link href={`/projects/${event.meta.projectId}`}>
              Ver proyecto
              <ArrowUpRight className="ml-1 size-3.5" />
            </Link>
          </Button>
        )}
        {event.href && !event.meta.projectId && !event.meta.leadId && (
          <Button asChild size="sm" onClick={onClose}>
            <Link href={event.href}>
              Abrir
              <ArrowUpRight className="ml-1 size-3.5" />
            </Link>
          </Button>
        )}
      </div>
    </DialogContent>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-muted-foreground">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="flex flex-wrap items-center gap-1">{children}</span>
    </div>
  );
}
