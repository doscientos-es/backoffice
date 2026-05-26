"use client";

import { markNotificationsRead } from "@/app/(app)/tasks/comment-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getBrowserClient } from "@/lib/supabase/browser";
import { cn, relativeTime } from "@/lib/utils";
import { AtSign, Bell, BellOff, CheckCheck, MessageSquare, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ComponentType,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

type Notif = {
  id: string;
  body: string | null;
  link: string | null;
  event_type: string;
  created_at: string;
  read_at: string | null;
  actor: { name: string | null; avatar_url: string | null } | null;
};

type NotifGroup = { key: "today" | "yesterday" | "earlier"; label: string; items: Notif[] };

const EVENT_META: Record<string, { icon: ComponentType<{ className?: string }>; tint: string }> = {
  task_comment: { icon: MessageSquare, tint: "text-blue-500" },
  task_mention: { icon: AtSign, tint: "text-violet-500" },
  task_assigned: { icon: UserPlus, tint: "text-emerald-500" },
};

function getEventMeta(eventType: string) {
  return EVENT_META[eventType] ?? { icon: Bell, tint: "text-muted-foreground" };
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function groupByDay(items: Notif[]): NotifGroup[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

  const groups: Record<NotifGroup["key"], Notif[]> = { today: [], yesterday: [], earlier: [] };
  for (const n of items) {
    const t = new Date(n.created_at).getTime();
    if (t >= startOfToday) groups.today.push(n);
    else if (t >= startOfYesterday) groups.yesterday.push(n);
    else groups.earlier.push(n);
  }

  return (
    [
      { key: "today", label: "Hoy" },
      { key: "yesterday", label: "Ayer" },
      { key: "earlier", label: "Anteriores" },
    ] as const
  )
    .map((g) => ({ ...g, items: groups[g.key] }))
    .filter((g) => g.items.length > 0);
}

export function NotificationsBell({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const fetchNotifs = useCallback(async () => {
    const supabase = getBrowserClient();
    const { data } = await supabase
      .from("notifications")
      .select(
        "id, body, link, event_type, created_at, read_at, actor:team_members!actor_id(name, avatar_url)",
      )
      .eq("recipient_id", memberId)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifs((data as unknown as Notif[]) ?? []);
  }, [memberId]);

  useEffect(() => {
    fetchNotifs();
    const supabase = getBrowserClient();
    const ch = supabase
      .channel(`notifs-${memberId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${memberId}`,
        },
        () => fetchNotifs(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [memberId, fetchNotifs]);

  const unread = useMemo(() => notifs.filter((n) => !n.read_at), [notifs]);
  const groups = useMemo(() => groupByDay(notifs), [notifs]);

  function markAllRead() {
    if (unread.length === 0) return;
    startTransition(async () => {
      await markNotificationsRead({});
      await fetchNotifs();
    });
  }

  function handleItemClick(n: Notif) {
    setOpen(false);
    if (!n.read_at) {
      startTransition(async () => {
        await markNotificationsRead({ ids: [n.id] });
        await fetchNotifs();
      });
    }
    if (n.link) router.push(n.link);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Notificaciones${unread.length > 0 ? ` (${unread.length} sin leer)` : ""}`}
        >
          <Bell className="h-4 w-4 text-muted-foreground" />
          {unread.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-96 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">Notificaciones</span>
            {unread.length > 0 && (
              <span className="text-xs text-muted-foreground">{unread.length} sin leer</span>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={markAllRead}
            disabled={unread.length === 0 || pending}
            className="text-xs"
          >
            <CheckCheck className="size-3" />
            Marcar leídas
          </Button>
        </div>

        {notifs.length === 0 ? (
          <Empty className="border-none p-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BellOff />
              </EmptyMedia>
              <EmptyTitle>Sin notificaciones</EmptyTitle>
              <EmptyDescription>Aquí verás menciones y comentarios en tus tareas.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="max-h-96 overflow-y-auto py-1">
            {groups.map((group) => (
              <li key={group.key}>
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                <ul>
                  {group.items.map((n) => {
                    const meta = getEventMeta(n.event_type);
                    const Icon = meta.icon;
                    const isUnread = !n.read_at;
                    const content = (
                      <div
                        className={cn(
                          "flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted/60",
                          isUnread && "bg-primary/5",
                        )}
                      >
                        <div className="relative shrink-0">
                          <Avatar size="sm">
                            {n.actor?.avatar_url ? (
                              <AvatarImage src={n.actor.avatar_url} alt={n.actor.name ?? ""} />
                            ) : null}
                            <AvatarFallback>{initials(n.actor?.name)}</AvatarFallback>
                          </Avatar>
                          <span
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-background ring-2 ring-background",
                              meta.tint,
                            )}
                          >
                            <Icon className="size-2.5" />
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-xs leading-relaxed text-foreground">
                            {n.actor?.name ? (
                              <span className="font-medium">{n.actor.name}</span>
                            ) : null}
                            {n.actor?.name && n.body ? " " : ""}
                            <span className={cn(!n.actor?.name && "text-foreground")}>
                              {n.body ?? n.event_type}
                            </span>
                          </p>
                          <span className="text-[10px] text-muted-foreground">
                            {relativeTime(n.created_at)}
                          </span>
                        </div>
                        {isUnread && (
                          <span
                            className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                            aria-label="Sin leer"
                          />
                        )}
                      </div>
                    );

                    return (
                      <li key={n.id} className="px-1">
                        {n.link ? (
                          <Link
                            href={n.link}
                            onClick={(e) => {
                              e.preventDefault();
                              handleItemClick(n);
                            }}
                            className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                          >
                            {content}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleItemClick(n)}
                            className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                          >
                            {content}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
