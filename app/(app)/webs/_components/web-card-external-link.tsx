"use client";

import { ExternalLink } from "lucide-react";

export function WebCardExternalLink({ url, name }: { url: string; name: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
      aria-label={`Abrir ${name}`}
      title="Abrir en nueva pestaña"
    >
      <ExternalLink className="size-3.5" />
    </a>
  );
}
