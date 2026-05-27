"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function ClientsError({
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
        <h1 className="text-xl font-semibold">Error al cargar los clientes</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          No se han podido cargar los clientes. Inténtalo de nuevo.
        </p>
        {error.digest && <p className="text-xs text-muted-foreground">ID: {error.digest}</p>}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset} size="sm">
          Reintentar
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/inicio">Ir al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
