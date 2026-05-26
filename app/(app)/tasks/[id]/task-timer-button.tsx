"use client";

import { startTimer, stopTimer } from "@/app/(app)/tasks/time-actions";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Play, Square } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";

type Props = {
  taskId: string;
  projectId: string;
  memberId: string;
};

export function TaskTimerButton({ taskId, projectId, memberId }: Props) {
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const fetchActive = useCallback(async () => {
    const supabase = getBrowserClient();
    const { data } = await supabase
      .from("time_entries")
      .select("id, task_id")
      .eq("member_id", memberId)
      .is("ended_at", null)
      .maybeSingle();
    // Active only if it's for THIS task
    setActiveEntryId(
      data && (data.task_id as string | null) === taskId ? (data.id as string) : null,
    );
  }, [memberId, taskId]);

  useEffect(() => {
    fetchActive();
    const supabase = getBrowserClient();
    const ch = supabase
      .channel(`task-timer-${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "time_entries", filter: `member_id=eq.${memberId}` },
        () => fetchActive(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [taskId, memberId, fetchActive]);

  const isRunning = activeEntryId !== null;

  return (
    <button
      type="button"
      title={isRunning ? "Parar timer" : "Iniciar timer"}
      onClick={() =>
        startTransition(async () => {
          if (isRunning) {
            await stopTimer();
          } else {
            await startTimer({ taskId, projectId });
          }
          await fetchActive();
        })
      }
      className={[
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        isRunning
          ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300"
          : "bg-muted text-muted-foreground hover:bg-muted/80",
      ].join(" ")}
    >
      {isRunning ? (
        <>
          <Square className="h-3 w-3 fill-current" />
          Parar timer
        </>
      ) : (
        <>
          <Play className="h-3 w-3 fill-current" />
          Iniciar timer
        </>
      )}
    </button>
  );
}
