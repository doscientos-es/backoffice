import { FileX as FileX2 } from "lucide-react";

export const metadata = { title: "Documento no encontrado · doscientos" };

export default function PortalNotFound() {
  return (
    <div className="mx-4 my-10 flex min-h-[28rem] flex-col items-center justify-center gap-6 rounded-[1.75rem] border border-black/[0.07] bg-white px-6 py-16 text-center shadow-sm dark:border-white/[0.09] dark:bg-[#181b17] sm:mx-6">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted ring-1 ring-border">
        <FileX2 className="size-8 text-muted-foreground" />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Error 404
        </p>
        <h1 className="text-balance text-2xl font-semibold tracking-tight">
          Documento no disponible
        </h1>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          Este enlace no es válido o ya no está disponible. Ponte en contacto con quien te lo envió
          para recibir uno nuevo.
        </p>
      </div>
    </div>
  );
}
