import { HOSTING_PROVIDER_LABELS } from "@/lib/schemas/web-project";
import { cn, relativeTime } from "@/lib/utils";
import { domainExpiryDays, domainExpiryState } from "@/lib/webs/domain-expiry";
import type { ExpiryState } from "@/lib/webs/domain-expiry";
import { checkSiteStatus } from "@/lib/webs/og";
import type { WebProjectListItem } from "@/lib/webs/types";
import { AlertTriangle, Clock, Globe, Server, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { WebCardExternalLink } from "./web-card-external-link";

// ─── Status dot ──────────────────────────────────────────────────────────────

async function SiteStatusDot({ url }: { url: string }) {
  const s = await checkSiteStatus(url);
  const label = s.ok
    ? `Online · ${s.status}${s.latencyMs !== null ? ` · ${s.latencyMs}ms` : ""}`
    : (s.error ?? `Error ${s.status ?? ""}`);
  return (
    <span
      className={cn(
        "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
        s.ok ? "bg-green-500" : "bg-destructive",
      )}
      title={label}
      aria-label={label}
    />
  );
}

function ExpiryBadge({ days, state }: { days: number; state: ExpiryState }) {
  if (state === "expired")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
        <ShieldAlert className="size-3" />
        Dominio vencido
      </span>
    );
  if (state === "critical")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
        <AlertTriangle className="size-3" />
        Vence en {days} día{days !== 1 ? "s" : ""}
      </span>
    );
  if (state === "warning")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
        <Clock className="size-3" />
        Vence en {days} días
      </span>
    );
  return null;
}

// ─── card ────────────────────────────────────────────────────────────────────

export function WebCard({ site }: { site: WebProjectListItem }) {
  const hostname = (() => {
    try {
      return new URL(site.url).hostname;
    } catch {
      return site.url;
    }
  })();

  const days = domainExpiryDays(site.domain_expires_at);
  const expiry = domainExpiryState(days);

  const hostingLabel = site.hosting_provider
    ? (HOSTING_PROVIDER_LABELS[site.hosting_provider as keyof typeof HOSTING_PROVIDER_LABELS] ??
      site.hosting_provider)
    : null;

  return (
    <Link
      href={`/webs/${site.id}`}
      className={cn(
        "group relative flex flex-col rounded-xl border bg-card transition-all",
        "hover:shadow-md hover:-translate-y-px",
        expiry === "warning"
          ? "border-amber-300/60 dark:border-amber-700/50"
          : expiry === "critical" || expiry === "expired"
            ? "border-destructive/40"
            : "border-border hover:border-primary/30",
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted ring-1 ring-border/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=64`}
            alt=""
            width={20}
            height={20}
            className="rounded-sm"
          />
          <Suspense
            fallback={
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-card bg-muted-foreground/30" />
            }
          >
            <SiteStatusDot url={site.url} />
          </Suspense>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
            {site.name}
          </p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <Globe className="size-3 shrink-0 opacity-60" />
            {hostname}
          </p>
        </div>
        <WebCardExternalLink url={site.url} name={site.name} />
      </div>

      {/* Client name */}
      {site.client_name ? (
        <div className="px-4 pb-3">
          <p className="truncate text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/70">Cliente:</span> {site.client_name}
          </p>
        </div>
      ) : null}

      {/* Footer */}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 rounded-b-xl border-t border-border/60 bg-muted/30 px-4 py-2.5">
        {days !== null && expiry !== "ok" && expiry !== null && (
          <ExpiryBadge days={days} state={expiry} />
        )}
        {hostingLabel && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-0.5 text-[10px] text-muted-foreground">
            <Server className="size-3 opacity-60" />
            {hostingLabel}
          </span>
        )}
        {site.tech_stack.slice(0, 3).map((t) => (
          <span
            key={t}
            className="rounded-full border border-border/70 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
          >
            {t}
          </span>
        ))}
        {site.tech_stack.length > 3 && (
          <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] text-muted-foreground">
            +{site.tech_stack.length - 3}
          </span>
        )}
        {site.updated_at && (
          <span
            className="ml-auto shrink-0 text-[10px] text-muted-foreground/60"
            title={site.updated_at}
          >
            {relativeTime(site.updated_at)}
          </span>
        )}
      </div>
    </Link>
  );
}
