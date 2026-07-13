import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty-state";
import { SectionBoundary } from "@/components/ui/error-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { listPosts } from "@/lib/social/repo";
import { Send } from "lucide-react";
import type { Metadata } from "next";
import { PostCard } from "../_components/post-card";
import { SyncButton } from "../_components/sync-button";

export const metadata: Metadata = { title: "Feed publicado · Social · doscientos" };
export const dynamic = "force-dynamic";

async function FeedList() {
  const allPosts = await listPosts();
  const published = allPosts.filter(
    (p) => p.status === "published" || p.status === "partially_failed",
  );

  if (published.length === 0) {
    return (
      <Empty className="mt-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Send />
          </EmptyMedia>
          <EmptyTitle>Nada publicado aún</EmptyTitle>
          <EmptyDescription>
            Aquí verás todas tus publicaciones que ya están en las redes.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {published.map((post) => (
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

export default async function FeedPage() {
  await requireUser();
  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/social" label="Social" />
      <PageHeader
        title="Feed publicado"
        description="Vista unificada de todo lo que has compartido en tus redes sociales."
        actions=<SyncButton kind="comments" label="Sincronizar comentarios" />
      />
      <SectionBoundary pending={<ListSkeleton />} label="No se pudo cargar el feed">
        <FeedList />
      </SectionBoundary>
    </div>
  );
}
