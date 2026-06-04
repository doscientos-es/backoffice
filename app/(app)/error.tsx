"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function AppError({
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
        <h1 className="text-xl font-semibold">Algo ha salido mal</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Ha ocurrido un error inesperado. Puedes intentarlo de nuevo o volver al inicio.
        </p>
        {error.digest && <p className="text-xs text-muted-foreground">ID: {error.digest}</p>}
      </div>
      <Button onClick={reset} size="sm">
        Reintentar
      </Button>
    </div>
  );
}
