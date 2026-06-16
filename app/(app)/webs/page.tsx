import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth";
import { HOSTING_PROVIDER_LABELS } from "@/lib/schemas/web-project";
import { listWebProjects } from "@/lib/webs/queries";
import type { WebProjectListItem } from "@/lib/webs/types";
import { cn } from "@/lib/utils";
import { ExternalLink, Globe, Plus } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = { title: "Webs · doscientos" };
export const dynamic = "force-dynamic";

function domainExpiryState(expiresAt: string | null): "ok" | "warning" | "danger" | null {
  if (!expiresAt) return null;
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "danger";
  if (days <= 30) return "danger";
  if (days <= 90) return "warning";
  return "ok";
}

function WebCard({ site }: { site: WebProjectListItem }) {
  const expiryState = domainExpiryState(site.domain_expires_at);
  const hostname = (() => {
    try { return new URL(site.url).hostname; } catch { return site.url; }
  })();

  return (
    <Link
      href={`/webs/${site.id}`}
      className="group block rounded-xl border border-border bg-card transition-all hover:border-primary/40 hover:shadow-sm"
    >
      <div className="flex items-start gap-3 p-4">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Image
            src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=64`}
            alt=""
            width={24}
            height={24}
            className="rounded-sm"
            unoptimized
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground group-hover:text-primary transition-colors">
            {site.name}
          </p>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground mt-0.5">
            <ExternalLink className="size-3 shrink-0" />
            {hostname}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-t border-border/60 px-4 py-3">
        {site.is_own && <Badge variant="info">Propia</Badge>}
        {site.client_name && <Badge variant="neutral">{site.client_name}</Badge>}
        {site.hosting_provider && (
          <Badge variant="neutral">
            {HOSTING_PROVIDER_LABELS[site.hosting_provider as keyof typeof HOSTING_PROVIDER_LABELS] ?? site.hosting_provider}
          </Badge>
        )}
        {site.domain_expires_at && (
          <Badge variant={expiryState === "danger" ? "danger" : expiryState === "warning" ? "warning" : "success"}>
            Dom. {new Date(site.domain_expires_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
          </Badge>
        )}
        {site.tech_stack.slice(0, 3).map((t) => (
          <Badge key={t} variant="neutral" className="font-mono text-[10px]">{t}</Badge>
        ))}
        {site.tech_stack.length > 3 && (
          <Badge variant="neutral" className="text-[10px]">+{site.tech_stack.length - 3}</Badge>
        )}
      </div>
    </Link>
  );
}

export default async function WebsPage() {
  await requireUser();
  const sites = await listWebProjects();

  const own = sites.filter((s) => s.is_own);
  const clients = sites.filter((s) => !s.is_own);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Webs"
        description="Proyectos web propios y de clientes — hosting, dominios y metadatos."
        actions={
          <Button asChild size="sm">
            <Link href="/webs/new"><Plus className="mr-1.5 h-4 w-4" />Nueva web</Link>
          </Button>
        }
      />

      {sites.length === 0 ? (
        <Empty>
          <EmptyHeader><Globe className="size-8 text-muted-foreground/40" /></EmptyHeader>
          <EmptyHeader><EmptyTitle>Aún no hay webs registradas.</EmptyTitle></EmptyHeader>
          <EmptyContent>
            <Button asChild size="sm"><Link href="/webs/new"><Plus className="mr-1.5 h-4 w-4" />Añadir primera web</Link></Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-8">
          {own.length > 0 && (
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Webs propias</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {own.map((s) => <WebCard key={s.id} site={s} />)}
              </div>
            </section>
          )}
          {clients.length > 0 && (
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Webs de clientes</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {clients.map((s) => <WebCard key={s.id} site={s} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
