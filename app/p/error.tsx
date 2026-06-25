"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertTriangle className="size-8 text-destructive" />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">No hemos podido mostrar el documento</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Ha ocurrido un problema al cargar esta página. Vuelve a intentarlo y, si el problema
          persiste, ponte en contacto con quien te envió el enlace.
        </p>
        {error.digest && <p className="text-xs text-muted-foreground">ID: {error.digest}</p>}
      </div>

      <Button onClick={() => reset()} size="sm">
        Reintentar
      </Button>
    </div>
  );
}
