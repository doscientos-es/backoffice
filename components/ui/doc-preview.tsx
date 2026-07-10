"use client";

import { FileText, Image as ImageIcon } from "lucide-react";

type Props = {
  /** Signed storage URL, generated server-side. Null = no preview. */
  url: string | null;
  mimeType: string | null;
  name: string;
};

export function DocPreview({ url, mimeType, name }: Props) {
  if (!url) {
    return <Fallback mimeType={mimeType} reason="no-url" />;
  }

  if (mimeType === "application/pdf" || mimeType === "text/plain" || mimeType === "text/csv") {
    return (
      <iframe
        src={url}
        title={name}
        className="w-full rounded-sm border-0"
        style={{ height: "75vh", minHeight: 400 }}
      />
    );
  }

  if (mimeType?.startsWith("image/")) {
    return (
      <div className="flex justify-center p-6 bg-muted/30 rounded-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name} className="max-w-full rounded object-contain max-h-[75vh]" />
      </div>
    );
  }
  return <Fallback mimeType={mimeType} reason="unsupported" />;
}

function Fallback({
  mimeType,
  reason,
}: {
  mimeType: string | null;
  reason: "no-url" | "unsupported";
}) {
  const Icon = mimeType?.startsWith("image/") ? ImageIcon : FileText;
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-muted-foreground">
      <Icon className="size-9 opacity-30" />
      <p className="text-sm">
        {reason === "no-url"
          ? "No se pudo generar la URL de preview."
          : "Preview no disponible para este tipo de archivo."}
      </p>
      {mimeType && <p className="text-xs opacity-50 font-mono">{mimeType}</p>}
      <p className="text-xs opacity-50">Usa el botón Descargar para abrir el archivo.</p>
    </div>
  );
}
