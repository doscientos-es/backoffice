"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ALL_LAYERS } from "@/lib/calendar/types";
import type { CalendarEventKind, CalendarView } from "@/lib/calendar/types";
import { CALENDAR_LAYER_COLORS, CALENDAR_LAYER_LABELS } from "@/lib/calendar/types";
import { cn, memberAvatarUrl } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Check, ChevronLeft, ChevronRight, Copy, Plus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { TeamMember } from "./calendar-grid";
import { useCalendarCreate } from "./calendar-grid";

type Props = {
  anchor: string;
  view: CalendarView;
  prevMonth: string;
  nextMonth: string;
  teamMembers: TeamMember[];
  activeLayers: Set<CalendarEventKind>;
  onToggleLayer: (l: CalendarEventKind) => void;
  activeMembers: Set<string>;
  onToggleMember: (id: string) => void;
  calendarToken: string | null;
};

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: "month", label: "Mes" },
  { value: "week", label: "Semana" },
  { value: "agenda", label: "Agenda" },
];

function navHref(params: URLSearchParams, overrides: Record<string, string>): string {
  const next = new URLSearchParams(params);
  for (const [k, v] of Object.entries(overrides)) next.set(k, v);
  return `/calendar?${next.toString()}`;
}

function memberInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}

export function CalendarHeader({
  anchor,
  view,
  prevMonth,
  nextMonth,
  teamMembers,
  activeLayers,
  onToggleLayer,
  activeMembers,
  onToggleMember,
  calendarToken,
}: Props) {
  const openCreate = useCalendarCreate();
  const anchorDate = parseISO(anchor);
  const sp = useSearchParams();
  const [copied, setCopied] = useState(false);

  function handleCopyIcal() {
    if (!calendarToken) return;
    const url = `${window.location.origin}/api/calendar/${calendarToken}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const title =
    view === "week"
      ? `Semana del ${format(anchorDate, "d MMM yyyy", { locale: es })}`
      : format(anchorDate, "MMMM yyyy", { locale: es });

  const prevAnchor = parseISO(prevMonth).toISOString().slice(0, 10);
  const nextAnchor = parseISO(nextMonth).toISOString().slice(0, 10);

  return (
    <div className="flex flex-col border-b border-border">
      {/* ── Row 1: navigation + view controls ─────────────────── */}
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        {/* Left: arrows + title */}
        <div className="flex items-center gap-1">
          <Link
            href={navHref(sp, { date: prevAnchor })}
            className="rounded p-1 hover:bg-secondary transition-colors"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-sm font-semibold capitalize w-36 text-center">{title}</h1>
          <Link
            href={navHref(sp, { date: nextAnchor })}
            className="rounded p-1 hover:bg-secondary transition-colors"
            aria-label="Siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Right: Nuevo + Google Calendar + Today + view selector */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openCreate()}
            className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo
          </button>
          {calendarToken && (
            <button
              type="button"
              onClick={handleCopyIcal}
              title="Copiar URL para Google Calendar / Apple Calendar"
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-secondary transition-colors"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "¡Copiado!" : "Suscribirse"}
            </button>
          )}
          <Link
            href={navHref(sp, { date: new Date().toISOString().slice(0, 10) })}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-secondary transition-colors"
          >
            Hoy
          </Link>
          <div className="flex rounded-md border border-border overflow-hidden text-xs font-medium">
            {VIEWS.map(({ value, label }) => (
              <Link
                key={value}
                href={navHref(sp, { view: value })}
                className={cn(
                  "px-2.5 py-1 transition-colors",
                  view === value
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-secondary text-muted-foreground",
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 2: scrollable filter chips ────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none px-4 py-1.5 bg-muted/30">
        {ALL_LAYERS.map((layer) => {
          const c = CALENDAR_LAYER_COLORS[layer];
          const active = activeLayers.has(layer);
          return (
            <button
              key={layer}
              type="button"
              onClick={() => onToggleLayer(layer)}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all",
                active
                  ? `${c.bg} ${c.text} border-transparent`
                  : "border-border text-muted-foreground opacity-40 hover:opacity-70",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full shrink-0",
                  active ? c.dot : "bg-muted-foreground",
                )}
              />
              {CALENDAR_LAYER_LABELS[layer]}
            </button>
          );
        })}

        {teamMembers.length > 1 && (
          <>
            <span className="shrink-0 mx-1 h-3.5 w-px bg-border" />
            {teamMembers.map((m) => {
              const active = activeMembers.has(m.id);
              const avatarSrc = memberAvatarUrl({
                avatarUrl: m.avatar_url,
                githubHandle: m.github_handle,
              });
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onToggleMember(m.id)}
                  title={m.name}
                  className={cn(
                    "shrink-0 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "ring-2 ring-primary ring-offset-1 ring-offset-background opacity-100"
                      : "opacity-35 hover:opacity-60",
                  )}
                >
                  <Avatar className="h-6 w-6">
                    {avatarSrc && <AvatarImage src={avatarSrc} alt={m.name} />}
                    <AvatarFallback className="text-[10px] font-semibold">
                      {memberInitials(m.name)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
