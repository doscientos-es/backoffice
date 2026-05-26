import { Button } from "@/components/ui/button";
import { SearchX } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Página no encontrada · doscientos" };

export default function GlobalNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <SearchX className="size-8 text-muted-foreground" />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Error 404
        </p>
        <h1 className="text-2xl font-semibold">Página no encontrada</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          La URL que has introducido no existe o ha sido movida. Comprueba que el enlace es
          correcto.
        </p>
      </div>

      <Button asChild>
        <Link href="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}
