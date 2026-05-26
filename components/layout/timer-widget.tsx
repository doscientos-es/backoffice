"use client";

import { stopTimer } from "@/app/(app)/tasks/time-actions";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Square, Timer } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

type ActiveEntry = {
  id: string;
  started_at: string;
  task_id: string | null;
  description: string | null;
};

function useElapsed(startedAt: string | null) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!startedAt) {
      setSecs(0);
      return;
    }
    const tick = () => setSecs(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return secs;
}

function fmt(secs: number) {
  const h = Math.floor(secs / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((secs % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function TimerWidget({ memberId }: { memberId: string }) {
  const [entry, setEntry] = useState<ActiveEntry | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof getBrowserClient>["channel"]> | null>(
    null,
  );
  const [, startTransition] = useTransition();
  const elapsed = useElapsed(entry?.started_at ?? null);

  const fetchActive = useCallback(async () => {
    const supabase = getBrowserClient();
    const { data } = await supabase
      .from("time_entries")
      .select("id, started_at, task_id, description")
      .eq("member_id", memberId)
      .is("ended_at", null)
      .maybeSingle();
    setEntry((data as ActiveEntry | null) ?? null);
  }, [memberId]);

  useEffect(() => {
    fetchActive();
    const supabase = getBrowserClient();
    const ch = supabase
      .channel(`timer-${memberId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "time_entries", filter: `member_id=eq.${memberId}` },
        () => fetchActive(),
      )
      .subscribe();
    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
    };
  }, [memberId, fetchActive]);

  if (!entry) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
      <Timer className="h-3.5 w-3.5 shrink-0 animate-pulse" />
      {entry.task_id ? (
        <Link
          href={`/tasks/${entry.task_id}`}
          className="tabular-nums hover:underline"
          title={entry.description ?? "Timer activo"}
        >
          {fmt(elapsed)}
        </Link>
      ) : (
        <span className="tabular-nums">{fmt(elapsed)}</span>
      )}
      <button
        type="button"
        title="Parar timer"
        onClick={() =>
          startTransition(async () => {
            await stopTimer();
          })
        }
        className="ml-0.5 rounded-full p-0.5 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
      >
        <Square className="h-3 w-3 fill-current" />
      </button>
    </div>
  );
}
