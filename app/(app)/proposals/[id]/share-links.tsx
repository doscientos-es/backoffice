"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Copy, ExternalLink, FileText, Presentation } from "lucide-react";
import { useState } from "react";
import { sileo } from "sileo";

type ShareLinkKind = "portal" | "deck";

type Meta = {
  label: string;
  path: (token: string) => string;
  Icon: typeof FileText;
};

const META: Record<ShareLinkKind, Meta> = {
  portal: { label: "Propuesta", path: (t) => `/p/proposal/${t}`, Icon: FileText },
  deck: { label: "Presentación", path: (t) => `/deck/${t}`, Icon: Presentation },
};

function formatViewedAt(value: string): string {
  return new Date(value).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Renders the two public share links of a proposal (portal + deck) with
 * copy-to-clipboard and open-in-new-tab affordances. The whole row is no
 * longer a single Link — actions are explicit so the hover state stays
 * subtle and clicks are intentional.
 */
export function ShareLinks({
  token,
  portalViewedAt,
  deckViewedAt,
}: {
  token: string;
  portalViewedAt: string | null;
  deckViewedAt: string | null;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <ShareLinkRow kind="portal" token={token} lastViewedAt={portalViewedAt} />
      <ShareLinkRow kind="deck" token={token} lastViewedAt={deckViewedAt} />
    </div>
  );
}

function ShareLinkRow({
  kind,
  token,
  lastViewedAt,
}: {
  kind: ShareLinkKind;
  token: string;
  lastViewedAt: string | null;
}) {
  const meta = META[kind];
  const path = meta.path(token);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const url = `${window.location.origin}${path}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      sileo.success({ title: "Enlace copiado" });
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      sileo.error({ title: "No se pudo copiar el enlace" });
    }
  };

  const handleOpen = () => {
    window.open(path, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-border/60 px-2.5 py-2 transition-colors",
        "hover:border-border hover:bg-muted/40",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <meta.Icon className="size-4" aria-hidden />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium leading-tight">{meta.label}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          {lastViewedAt ? (
            <>
              <span
                className="inline-flex size-1.5 shrink-0 rounded-full bg-emerald-500"
                aria-hidden
              />
              <time
                dateTime={lastViewedAt}
                className="text-emerald-700 tabular-nums dark:text-emerald-400"
              >
                Vista el {formatViewedAt(lastViewedAt)}
              </time>
            </>
          ) : (
            <>
              <span
                className="inline-flex size-1.5 shrink-0 rounded-full bg-muted-foreground/40"
                aria-hidden
              />
              <span>Sin abrir</span>
            </>
          )}
          <span className="text-muted-foreground/60" aria-hidden>
            ·
          </span>
          <span className="truncate font-mono text-muted-foreground/80">{path}</span>
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleCopy}
          aria-label="Copiar enlace"
          title="Copiar enlace"
        >
          {copied ? (
            <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleOpen}
          aria-label="Abrir en pestaña nueva"
          title="Abrir en pestaña nueva"
        >
          <ExternalLink className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
