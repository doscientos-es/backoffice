"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle, Send, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { publishPost } from "../actions";

type Phase = "idle" | "loading" | "success" | "error";

/**
 * Publishes (or retries) a post from the dashboard/detail. Optimistic phase
 * feedback with a router refresh so the fan-out result lands in the list.
 */
export function PublishButton({
  postId,
  label = "Publicar",
  retry = false,
  size = "sm",
  variant,
}: {
  postId: string;
  label?: string;
  retry?: boolean;
  size?: React.ComponentProps<typeof Button>["size"];
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handle() {
    setPhase("loading");
    setError(null);
    let res: Awaited<ReturnType<typeof publishPost>>;
    try {
      res = await publishPost({ postId });
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Error inesperado");
      return;
    }
    if (!res.ok) {
      setPhase("error");
      setError(res.error);
      return;
    }
    setPhase("success");
    router.refresh();
    setTimeout(() => setPhase("idle"), 2500);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={handle}
        disabled={phase === "loading"}
        size={size}
        variant={variant ?? (retry ? "outline" : "default")}
        aria-busy={phase === "loading" || undefined}
        className={cn(
          phase === "success" && "border-success/50 text-success",
          phase === "error" && "border-destructive/50 text-destructive",
        )}
      >
        {phase === "success" ? (
          <CheckCircle className="size-3.5" />
        ) : phase === "error" ? (
          <XCircle className="size-3.5" />
        ) : (
          <Send className={cn("size-3.5", phase === "loading" && "animate-pulse")} />
        )}
        {phase === "loading" ? "Publicando…" : retry ? "Reintentar" : label}
      </Button>
      {phase === "error" && error && (
        <p className="max-w-xs text-right text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
