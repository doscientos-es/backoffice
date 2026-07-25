"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { syncGoogleBusinessPerformance, syncGoogleBusinessReviews } from "../actions";

export function GoogleBusinessSyncButton({
  kind,
  label,
}: {
  kind: "reviews" | "performance";
  label: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSync() {
    setPending(true);
    setMessage(null);
    try {
      const result =
        kind === "reviews"
          ? await syncGoogleBusinessReviews()
          : await syncGoogleBusinessPerformance({ days: 30 });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage(`${result.synced} actualizados`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleSync} disabled={pending}>
        <RefreshCw className={pending ? "size-3.5 animate-spin" : "size-3.5"} />
        {pending ? "Sincronizando…" : label}
      </Button>
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </div>
  );
}