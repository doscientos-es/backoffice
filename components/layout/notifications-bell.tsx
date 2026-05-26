"use client";

import { markNotificationsRead } from "@/app/(app)/tasks/comment-actions";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

type Notif = {
  id: string;
  body: string | null;
  link: string | null;
  event_type: string;
  created_at: string;
  read_at: string | null;
};

function useClickOutside(ref: React.RefObject<HTMLElement | null>, fn: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) fn();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, fn]);
}

export function NotificationsBell({ memberId }: { memberId: string }) {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  const fetchNotifs = useCallback(async () => {
    const supabase = getBrowserClient();
    const { data } = await supabase
      .from("notifications")
      .select("id, body, link, event_type, created_at, read_at")
      .eq("recipient_id", memberId)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifs((data as Notif[]) ?? []);
  }, [memberId]);

  useEffect(() => {
    fetchNotifs();
    const supabase = getBrowserClient();
    const ch = supabase
      .channel(`notifs-${memberId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${memberId}` },
        () => fetchNotifs(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [memberId, fetchNotifs]);

  const unread = notifs.filter((n) => !n.read_at);

  function handleOpen() {
    setOpen((o) => !o);
    if (!open && unread.length > 0) {
      startTransition(async () => {
        await markNotificationsRead({});
        await fetchNotifs();
      });
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="relative flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors"
        aria-label={`Notificaciones${unread.length > 0 ? ` (${unread.length} nuevas)` : ""}`}
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        {unread.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-80 rounded-xl border border-border bg-background shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-semibold">Notificaciones</span>
            {notifs.length > 0 && (
              <Link href="/notifications" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:underline">
                Ver todas
              </Link>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto divide-y divide-border">
            {notifs.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                Sin notificaciones.
              </li>
            ) : (
              notifs.map((n) => (
                <li
                  key={n.id}
                  className={`px-3 py-2.5 hover:bg-muted/40 transition-colors ${!n.read_at ? "bg-primary/5" : ""}`}
                >
                  {n.link ? (
                    <Link
                      href={n.link}
                      onClick={() => setOpen(false)}
                      className="block text-xs leading-relaxed hover:underline"
                    >
                      {n.body ?? n.event_type}
                    </Link>
                  ) : (
                    <p className="text-xs leading-relaxed">{n.body ?? n.event_type}</p>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
