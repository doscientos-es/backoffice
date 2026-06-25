import { FileX2 } from "lucide-react";

export const metadata = { title: "Documento no encontrado · doscientos" };

export default function PortalNotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <FileX2 className="size-8 text-muted-foreground" />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Error 404
        </p>
        <h1 className="text-2xl font-semibold">Documento no disponible</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Este enlace ha caducado o ya no es válido. Ponte en contacto con quien te lo envió para
          recibir uno nuevo.
        </p>
      </div>
    </div>
  );
}
