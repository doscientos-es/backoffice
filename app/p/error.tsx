"use client";

import { TriangleAlert as AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-4 my-10 flex min-h-[28rem] flex-col items-center justify-center gap-6 rounded-[1.75rem] border border-black/[0.07] bg-white px-6 py-16 text-center shadow-sm dark:border-white/[0.09] dark:bg-[#181b17] sm:mx-6">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10 ring-1 ring-destructive/10">
        <AlertTriangle className="size-8 text-destructive" />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-balance text-2xl font-semibold tracking-tight">
          No hemos podido mostrar el documento
        </h1>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          Ha ocurrido un problema al cargar esta página. Vuelve a intentarlo y, si el problema
          persiste, ponte en contacto con quien te envió el enlace.
        </p>
        {error.digest && <p className="text-xs text-muted-foreground">ID: {error.digest}</p>}
      </div>

      <Button onClick={() => reset()} size="lg" className="rounded-xl px-4">
        Reintentar
      </Button>
    </div>
  );
}
