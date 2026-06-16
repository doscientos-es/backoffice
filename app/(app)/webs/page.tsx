import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth";
import { HOSTING_PROVIDER_LABELS } from "@/lib/schemas/web-project";
import { listWebProjects } from "@/lib/webs/queries";
import type { WebProjectListItem } from "@/lib/webs/types";
import { cn, relativeTime } from "@/lib/utils";
import { WebFilters } from "./_components/web-filters";
import {
  AlertTriangle,
  Clock,
  ExternalLink,
  Globe,
  Plus,
  Server,
  ShieldAlert,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = { title: "Webs · doscientos" };
export const dynamic = "force-dynamic";

// ─── domain expiry helpers ──────────────────────────────────────────────────

type ExpiryState = "expired" | "critical" | "warning" | "ok" | null;

function domainExpiryDays(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
}

function domainExpiryState(days: number | null): ExpiryState {
  if (days === null) return null;
  if (days < 0) return "expired";
  if (days <= 14) return "critical";
  if (days <= 60) return "warning";
  return "ok";
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
  return null; // "ok" → don't clutter; date visible on hover/detail
}

// ─── card ───────────────────────────────────────────────────────────────────

function WebCard({ site }: { site: WebProjectListItem }) {
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
      {/* ── Header ── */}
      <div className="flex items-start gap-3 p-4 pb-3">
        {/* Favicon */}
        <div className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted ring-1 ring-border/60">
          <Image
            src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=64`}
            alt=""
            width={20}
            height={20}
            className="rounded-sm"
            unoptimized
          />
        </div>

        {/* Name + URL */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
            {site.name}
          </p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <Globe className="size-3 shrink-0 opacity-60" />
            {hostname}
          </p>
        </div>

        {/* Quick open — stops card click propagation */}
        <a
          href={site.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
          aria-label={`Abrir ${site.name}`}
          title="Abrir en nueva pestaña"
        >
          <ExternalLink className="size-3.5" />
        </a>
      </div>

      {/* ── Client / type row ── */}
      {(!site.is_own || site.client_name) && (
        <div className="px-4 pb-3">
          {site.client_name ? (
            <p className="truncate text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/70">Cliente:</span>{" "}
              {site.client_name}
            </p>
          ) : null}
        </div>
      )}

      {/* ── Footer metadata ── */}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 rounded-b-xl border-t border-border/60 bg-muted/30 px-4 py-2.5">
        {/* Domain urgency */}
        {days !== null && expiry !== "ok" && expiry !== null && (
          <ExpiryBadge days={days} state={expiry} />
        )}

        {/* Hosting */}
        {hostingLabel && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-0.5 text-[10px] text-muted-foreground">
            <Server className="size-3 opacity-60" />
            {hostingLabel}
          </span>
        )}

        {/* Tech stack */}
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

        {/* Last updated — pushed to the right */}
        {site.updated_at && (
          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/60" title={site.updated_at}>
            {relativeTime(site.updated_at)}
          </span>
        )}
      </div>
    </Link>
  );
}

// ─── alert bar ──────────────────────────────────────────────────────────────

function ExpiryAlertBar({ sites }: { sites: WebProjectListItem[] }) {
  const urgent = sites.filter((s) => {
    const d = domainExpiryDays(s.domain_expires_at);
    const state = domainExpiryState(d);
    return state === "expired" || state === "critical";
  });
  if (urgent.length === 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
      <ShieldAlert className="size-4 shrink-0" />
      <span>
        {urgent.length === 1
          ? `El dominio de "${urgent[0]?.name}" requiere atención inmediata.`
          : `${urgent.length} dominios requieren atención inmediata.`}
      </span>
    </div>
  );
}

// ─── section ────────────────────────────────────────────────────────────────

function Section({ title, sites }: { title: string; sites: WebProjectListItem[] }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
          {sites.length}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sites.map((s) => (
          <WebCard key={s.id} site={s} />
        ))}
      </div>
    </section>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

type PageProps = {
  searchParams: Promise<{ q?: string; type?: string }>;
};

export default async function WebsPage({ searchParams }: PageProps) {
  await requireUser();
  const [sites, { q = "", type = "all" }] = await Promise.all([
    listWebProjects(),
    searchParams,
  ]);

  const query = q.trim().toLowerCase();
  const filtered = sites.filter((s) => {
    const matchesType =
      type === "own" ? s.is_own : type === "clients" ? !s.is_own : true;
    const matchesQuery =
      !query ||
      s.name.toLowerCase().includes(query) ||
      s.url.toLowerCase().includes(query) ||
      (s.client_name ?? "").toLowerCase().includes(query) ||
      s.tech_stack.some((t) => t.toLowerCase().includes(query));
    return matchesType && matchesQuery;
  });

  const own = filtered.filter((s) => s.is_own);
  const clients = filtered.filter((s) => !s.is_own);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Webs"
        description="Proyectos web propios y de clientes — hosting, dominios y metadatos."
        actions={
          <Button asChild size="sm">
            <Link href="/webs/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Nueva web
            </Link>
          </Button>
        }
      />

      {/* ── Search + type filter ── */}
      <WebFilters q={q} type={type} total={sites.length} />

      {/* ── Domain urgency alert ── */}
      <ExpiryAlertBar sites={sites} />

      {/* ── Content ── */}
      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <Globe className="size-8 text-muted-foreground/40" />
          </EmptyHeader>
          <EmptyHeader>
            <EmptyTitle>
              {sites.length === 0 ? "Aún no hay webs registradas." : "Sin coincidencias."}
            </EmptyTitle>
          </EmptyHeader>
          {sites.length === 0 && (
            <EmptyContent>
              <Button asChild size="sm">
                <Link href="/webs/new">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Añadir primera web
                </Link>
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="flex flex-col gap-8">
          {own.length > 0 && <Section title="Webs propias" sites={own} />}
          {clients.length > 0 && <Section title="Webs de clientes" sites={clients} />}
        </div>
      )}
    </div>
  );
}


