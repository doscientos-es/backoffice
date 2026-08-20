"use client";

import { Warning as AlertTriangle } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Catches errors thrown while rendering an individual lead detail page. */
export default function LeadDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertTriangle className="size-8 text-destructive" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Error al cargar el lead</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          No se ha podido cargar esta ficha. Inténtalo de nuevo o vuelve a los leads.
        </p>
        {error.digest && <p className="text-xs text-muted-foreground">ID: {error.digest}</p>}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset} size="sm">
          Reintentar
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/leads">Volver a leads</Link>
        </Button>
      </div>
    </div>
  );
}
