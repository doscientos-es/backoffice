import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty-state";
import { SectionBoundary } from "@/components/ui/error-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { PLATFORM_LABELS, SOCIAL_PLATFORMS } from "@/lib/social/core";
import { googleBusinessOAuthConfigured } from "@/lib/social/google-business";
import { listPosts } from "@/lib/social/repo";
import { availablePlatforms } from "@/lib/social/service";
import { cn } from "@/lib/utils";
import { Inbox, Plus, Send, Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ImportInstagramButton } from "./_components/import-instagram-button";
import { PlatformIcon } from "./_components/platform";
import { PostCard } from "./_components/post-card";
import { SyncButton } from "./_components/sync-button";

export const metadata: Metadata = { title: "Social · doscientos" };
export const dynamic = "force-dynamic";

/** Compact strip showing which networks are connected (env-configured). */
function Connections() {
  const available = new Set(availablePlatforms());
  return (
    <div className="flex flex-wrap items-center gap-2">
      {SOCIAL_PLATFORMS.map((p) => {
        const on = available.has(p);
        return (
          <span
            key={p}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1",
              on
                ? "bg-success/10 text-success ring-success/20"
                : "bg-muted text-muted-foreground ring-border",
            )}
            title={on ? "Conectado" : "Sin configurar"}
          >
            <PlatformIcon platform={p} className="size-3.5" />
            {PLATFORM_LABELS[p]}
            <span
              className={cn("size-1.5 rounded-full", on ? "bg-success" : "bg-muted-foreground/40")}
            />
          </span>
        );
      })}
    </div>
  );
}

async function PostsList() {
  const posts = await listPosts();
  if (posts.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Send />
          </EmptyMedia>
          <EmptyTitle>Aún no has creado ninguna publicación.</EmptyTitle>
          <EmptyDescription>
            Redacta un post una vez y publícalo en todas tus redes conectadas a la vez.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild size="sm">
            <Link href="/social/compose">
              <Plus className="size-4" />
              Crear publicación
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
          <div className="flex gap-3">
            <Skeleton className="size-20 shrink-0 rounded-lg" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  );
}

export default async function SocialPage() {
  await requireUser();
  const available = availablePlatforms();
  const instagramConnected = available.includes("instagram");
  const googleBusinessNeedsSetup =
    googleBusinessOAuthConfigured() && !available.includes("google_business_profile");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Social"
        description="Publica en todas tus redes desde un único sitio."
        actions={
          <>
            {instagramConnected && <ImportInstagramButton />}
            {googleBusinessNeedsSetup && (
              <Button asChild variant="outline" size="sm">
                <Link href="/api/social/google-business/auth">Conectar Google Business</Link>
              </Button>
            )}
            <SyncButton kind="insights" label="Sincronizar métricas" />
            <Button asChild variant="outline" size="sm">
              <Link href="/social/feed">
                <Send className="size-4" />
                Ver Feed
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/social/feed/inbox">
                <Inbox className="size-4" />
                Comentarios
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/social/automation">
                <Settings className="size-4" />
                Automatizaciones
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/social/compose">
                <Plus className="size-4" />
                Nueva publicación
              </Link>
            </Button>
          </>
        }
      />
      <Connections />
      <SectionBoundary pending={<ListSkeleton />} label="No se pudieron cargar las publicaciones">
        <PostsList />
      </SectionBoundary>
    </div>
  );
}
