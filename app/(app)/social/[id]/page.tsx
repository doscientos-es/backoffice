import { BackLink } from "@/components/layout/back-link";
import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionBoundary } from "@/components/ui/error-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth";
import { getPostDetail } from "@/lib/social/service";
import { SOCIAL_POST_STATUS, SOCIAL_TARGET_STATUS } from "@/lib/status";
import { formatDateTime, relativeTime } from "@/lib/utils";
import { BarChart3, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MediaThumb } from "../_components/media-thumb";
import { PlatformChip } from "../_components/platform";
import { PublishButton } from "../_components/publish-button";
import { SyncButton } from "../_components/sync-button";

export async function generateMetadata({
  params,
}: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = await getPostDetail(id);
  return { title: post ? `${post.caption.slice(0, 20)}... · Social` : "Post · Social" };
}

async function PostDetail({ id }: { id: string }) {
  const post = await getPostDetail(id);
  if (!post) notFound();

  const isPublished = post.status === "published" || post.status === "partially_failed";

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Contenido</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="text-sm leading-relaxed whitespace-pre-wrap">{post.caption}</div>
              {post.media.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {post.media.map((item, i) => (
                    <MediaThumb key={item.storagePath + i} item={item} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Insights / Targets */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Resultados por red</CardTitle>
              {isPublished && <SyncButton kind="insights" label="Sincronizar métricas" />}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Red</th>
                      <th className="pb-2 pr-4 font-medium">Estado</th>
                      <th className="pb-2 pr-4 font-medium text-right">Alcance</th>
                      <th className="pb-2 pr-4 font-medium text-right">Me gusta</th>
                      <th className="pb-2 pr-4 font-medium text-right">Coment.</th>
                      <th className="pb-2 font-medium text-right">Enlace</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {post.targets.map((t) => (
                      <tr key={t.id} className="group">
                        <td className="py-3 pr-4">
                          <PlatformChip platform={t.platform} />
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-col gap-0.5">
                            <StatusBadge
                              meta={SOCIAL_TARGET_STATUS}
                              value={t.status}
                              className="text-[10px]"
                            />
                            {t.status === "failed" && t.error && (
                              <span
                                className="max-w-50 text-[10px] text-destructive leading-tight"
                                title={t.error}
                              >
                                {t.error.length > 80 ? `${t.error.slice(0, 80)}…` : t.error}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums">
                          {t.insights?.reach.toLocaleString() ?? "—"}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums">
                          {t.insights?.likes.toLocaleString() ?? "—"}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums">
                          {t.insights?.comments.toLocaleString() ?? "—"}
                        </td>
                        <td className="py-3 text-right">
                          {t.remoteUrl ? (
                            <a
                              href={t.remoteUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                            >
                              Ver <ExternalLink className="size-3" />
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar info */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Información</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailGrid>
                <DetailRow label="Estado">
                  <StatusBadge meta={SOCIAL_POST_STATUS} value={post.status} />
                </DetailRow>
                <DetailRow label="Creado">
                  <div className="flex flex-col">
                    <span>{formatDateTime(post.createdAt)}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {relativeTime(post.createdAt)}
                    </span>
                  </div>
                </DetailRow>
                {post.publishedAt && (
                  <DetailRow label="Publicado">
                    <span>{formatDateTime(post.publishedAt)}</span>
                  </DetailRow>
                )}
                {post.scheduledAt && !post.publishedAt && (
                  <DetailRow label="Programado">
                    <span>{formatDateTime(post.scheduledAt)}</span>
                  </DetailRow>
                )}
              </DetailGrid>

              {post.status === "draft" && (
                <div className="mt-6 border-t border-border pt-4">
                  <PublishButton
                    postId={post.id}
                    label="Publicar ahora"
                    size="default"
                    className="w-full"
                  />
                </div>
              )}
              {(post.status === "failed" || post.status === "partially_failed") && (
                <div className="mt-6 border-t border-border pt-4">
                  <PublishButton postId={post.id} retry size="default" className="w-full" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <BarChart3 className="size-4" />
                Resumen de impacto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Simplified aggregate stats if published */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase text-muted-foreground">Reach Total</span>
                  <span className="text-xl font-bold tabular-nums">
                    {post.targets
                      .reduce((acc, t) => acc + (t.insights?.reach ?? 0), 0)
                      .toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase text-muted-foreground">Eng. Medio</span>
                  <span className="text-xl font-bold tabular-nums">
                    {(
                      (post.targets.reduce((acc, t) => acc + (t.insights?.engagementRate ?? 0), 0) /
                        (post.targets.filter((t) => t.insights).length || 1)) *
                      100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
        <div className="flex flex-col gap-6">
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[150px] w-full" />
        </div>
      </div>
    </div>
  );
}

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/social" label="Social" />
      <PageHeader
        title="Detalle de publicación"
        description="Métricas y estado de publicación en tiempo real."
      />
      <SectionBoundary pending={<DetailSkeleton />} label="No se pudo cargar el detalle">
        <PostDetail id={id} />
      </SectionBoundary>
    </div>
  );
}
