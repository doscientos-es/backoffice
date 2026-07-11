"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CALENDAR_LAYER_COLORS, CALENDAR_LAYER_LABELS, type CalendarEvent } from "@/lib/calendar/types";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  Tag,
  User,
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
            className={cn(
              "text-base leading-snug",
              event.done && "line-through opacity-60",
            )}
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
          {event.done && (
            <CheckCircle2 className="ml-1 size-3.5 text-muted-foreground" />
          )}
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

        {/* Project / client */}
        {(event.meta.projectName || event.meta.clientName) && (
          <Row icon={<span className="size-3.5 text-center text-[10px] leading-none">📁</span>}>
            <span className="text-foreground">
              {event.meta.projectName ?? event.meta.clientName}
              {event.meta.projectName && event.meta.clientName && (
                <span className="ml-1 text-muted-foreground">· {event.meta.clientName}</span>
              )}
            </span>
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
        {event.href && (
          <Button asChild size="sm" onClick={onClose}>
            <Link href={event.href}>
              Abrir página
              <ArrowUpRight className="ml-1 size-3.5" />
            </Link>
          </Button>
        )}
        {event.meta.meetUrl && (
          <Button asChild size="sm" variant="outline" onClick={onClose}>
            <a href={event.meta.meetUrl} target="_blank" rel="noopener noreferrer">
              Unirse
              <ArrowUpRight className="ml-1 size-3.5" />
            </a>
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
