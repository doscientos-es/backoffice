"use client";

import { CheckCircleIcon as CheckCircle, ArrowsClockwise as RefreshCw, XCircleIcon as XCircle } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { syncGoogleBusinessPerformance, syncGoogleBusinessReviews } from "../actions";

type Phase = "idle" | "loading" | "success" | "error";

export function GoogleBusinessSyncButton({
  kind,
  label,
}: {
  kind: "reviews" | "performance";
  label: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSync() {
    setPhase("loading");
    setMessage(null);
    try {
      const result =
        kind === "reviews"
          ? await syncGoogleBusinessReviews()
          : await syncGoogleBusinessPerformance({ days: 30 });
      if (!result.ok) {
        setPhase("error");
        setMessage(result.error);
        return;
      }
      setPhase("success");
      setMessage(`${result.synced} actualizados`);
      router.refresh();
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Error inesperado");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={phase === "loading"}
        aria-busy={phase === "loading" || undefined}
        className={cn(
          phase === "success" && "border-success/50 text-success",
          phase === "error" && "border-destructive/50 text-destructive",
        )}
      >
        {phase === "success" ? (
          <CheckCircle className="size-3.5 text-success" />
        ) : phase === "error" ? (
          <XCircle className="size-3.5 text-destructive" />
        ) : (
          <RefreshCw className={cn("size-3.5", phase === "loading" && "animate-spin")} />
        )}
        {phase === "loading" ? "Sincronizando…" : label}
      </Button>
      {phase !== "idle" && phase !== "loading" && message && (
        <p
          role={phase === "error" ? "alert" : "status"}
          className={cn(
            "max-w-xs text-right text-xs",
            phase === "error" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
}
