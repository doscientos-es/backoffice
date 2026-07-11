/**
 * Social Hub — posts & targets repository.
 *
 * DB access for social_posts + social_post_targets. Maps snake_case rows to the
 * camelCase view models in lib/social/types.ts and back. User-driven reads/writes
 * go through the RLS-enforced server client; the fan-out status writes reuse it
 * since publishing is always triggered from an authenticated action.
 */
import { scopedLogger } from "@/lib/logger";
import type {
  FanOutResult,
  MediaItem,
  MediaKind,
  PostStatus,
  SocialPlatform,
  TargetStatus,
} from "@/lib/social/core";
import { deriveMediaKind } from "@/lib/social/core";
import type { CreatePostInput, PostListItem, TargetView } from "@/lib/social/types";
import { notDeleted } from "@/lib/supabase/filters";
import { createServerClient } from "@/lib/supabase/server";
import { getInsightsByTarget } from "./insights";

const log = scopedLogger("social-repo-posts");

interface TargetRow {
  id: string;
  platform: string;
  status: string;
  caption: string | null;
  remote_id: string | null;
  remote_url: string | null;
  error: string | null;
  published_at: string | null;
}

interface PostRow {
  id: string;
  caption: string;
  media_kind: string;
  media: MediaItem[];
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  social_post_targets?: TargetRow[];
}

/**
 * Decide the value stored in `social_post_targets.caption`: `null` when the
 * override is absent or identical to the shared caption (so the target simply
 * inherits it), otherwise the trimmed-preserving override string.
 */
function resolveOverride(override: string | undefined, shared: string): string | null {
  if (override === undefined || override === shared) return null;
  return override;
}

function mapTarget(row: TargetRow): TargetView {
  return {
    id: row.id,
    platform: row.platform as SocialPlatform,
    status: row.status as TargetStatus,
    caption: row.caption,
    remoteId: row.remote_id,
    remoteUrl: row.remote_url,
    error: row.error,
    publishedAt: row.published_at,
  };
}

function mapPost(
  row: PostRow,
  metrics: { likes: number; comments: number } = { likes: 0, comments: 0 },
): PostListItem {
  return {
    id: row.id,
    caption: row.caption,
    mediaKind: row.media_kind as MediaKind,
    media: Array.isArray(row.media) ? row.media : [],
    status: row.status as PostStatus,
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    targets: (row.social_post_targets ?? []).map(mapTarget),
    metrics,
  };
}

const POST_SELECT =
  "id, caption, media_kind, media, status, scheduled_at, published_at, created_at, " +
  "social_post_targets(id, platform, status, caption, remote_id, remote_url, error, published_at)";

/** Insert a composed post plus one pending target per selected platform. */
export async function createPost(input: CreatePostInput): Promise<string> {
  const supabase = await createServerClient();
  const mediaKind = deriveMediaKind(input.media);
  const status: PostStatus = input.scheduledAt ? "scheduled" : "draft";

  const { data, error } = await supabase
    .from("social_posts")
    .insert({
      caption: input.caption,
      media_kind: mediaKind,
      media: input.media,
      status,
      scheduled_at: input.scheduledAt,
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`No se pudo crear el post: ${error?.message}`);

  const postId = data.id as string;
  const targets = input.platforms.map((platform) => ({
    post_id: postId,
    platform,
    // Store an override only when it differs from the shared caption; otherwise
    // leave NULL so the target inherits `social_posts.caption` at publish time.
    caption: resolveOverride(input.captions?.[platform], input.caption),
  }));
  const { error: targetErr } = await supabase.from("social_post_targets").insert(targets);
  if (targetErr) throw new Error(`No se pudieron crear los destinos: ${targetErr.message}`);

  return postId;
}

/** List non-deleted posts newest-first with their targets. */
export async function listPosts(): Promise<PostListItem[]> {
  const supabase = await createServerClient();
  const { data, error } = await notDeleted(supabase.from("social_posts").select(POST_SELECT)).order(
    "created_at",
    { ascending: false },
  );
  if (error) {
    log.error({ err: error.message }, "list_posts_failed");
    return [];
  }
  const rows = data as unknown as PostRow[];

  // Aggregate engagement per post from the already-synced insights snapshots.
  // One batched read keyed by target id — no live calls to the social APIs.
  const targetIds = rows.flatMap((r) => (r.social_post_targets ?? []).map((t) => t.id));
  const insights = await getInsightsByTarget(targetIds);
  return rows.map((row) => {
    const metrics = (row.social_post_targets ?? []).reduce(
      (acc, t) => {
        const ins = insights.get(t.id);
        if (ins) {
          acc.likes += ins.likes;
          acc.comments += ins.comments;
        }
        return acc;
      },
      { likes: 0, comments: 0 },
    );
    return mapPost(row, metrics);
  });
}

/** Fetch one post with targets, or null. */
export async function getPost(id: string): Promise<PostListItem | null> {
  const supabase = await createServerClient();
  const { data, error } = await notDeleted(
    supabase.from("social_posts").select(POST_SELECT).eq("id", id),
  ).maybeSingle();
  if (error) log.error({ id, err: error.message }, "get_post_failed");
  return data ? mapPost(data as unknown as PostRow) : null;
}

/** Flip a post + all its targets into the `publishing` state. */
export async function markPublishing(postId: string): Promise<void> {
  const supabase = await createServerClient();
  await supabase.from("social_posts").update({ status: "publishing" }).eq("id", postId);
  await supabase
    .from("social_post_targets")
    .update({ status: "publishing", error: null })
    .eq("post_id", postId);
}

/** Persist a fan-out result: per-target status + rolled-up post status. */
export async function applyFanOut(postId: string, result: FanOutResult): Promise<void> {
  const supabase = await createServerClient();
  const now = new Date().toISOString();

  await Promise.all(
    result.targets.map((t) =>
      supabase
        .from("social_post_targets")
        .update({
          status: t.ok ? "published" : "failed",
          remote_id: t.remoteId ?? null,
          remote_url: t.remoteUrl ?? null,
          error: t.ok ? null : (t.error ?? "Error desconocido"),
          published_at: t.ok ? now : null,
        })
        .eq("post_id", postId)
        .eq("platform", t.platform),
    ),
  );

  const anyOk = result.targets.some((t) => t.ok);
  await supabase
    .from("social_posts")
    .update({ status: result.status, published_at: anyOk ? now : null })
    .eq("id", postId);
}

/** Soft-delete a post (sets `deleted_at`). */
export async function deletePost(postId: string): Promise<void> {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("social_posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) throw new Error(`No se pudo eliminar el post: ${error.message}`);
}

/** Restore a soft-deleted post (clears `deleted_at`). */
export async function restorePost(postId: string): Promise<void> {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("social_posts")
    .update({ deleted_at: null })
    .eq("id", postId);
  if (error) throw new Error(`No se pudo restaurar el post: ${error.message}`);
}

/** A published target with a remote id, ready for insight/comment sync. */
export interface PublishedTarget {
  id: string;
  platform: SocialPlatform;
  remoteId: string;
}

/** Published targets for a specific post (used for remote deletion fan-out). */
export async function getPublishedTargetsForPost(postId: string): Promise<PublishedTarget[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("social_post_targets")
    .select("id, platform, remote_id")
    .eq("post_id", postId)
    .eq("status", "published")
    .not("remote_id", "is", null);
  if (error) {
    log.error({ err: error.message, postId }, "get_published_targets_for_post_failed");
    return [];
  }
  return (data as { id: string; platform: string; remote_id: string }[]).map((r) => ({
    id: r.id,
    platform: r.platform as SocialPlatform,
    remoteId: r.remote_id,
  }));
}

/** Every target that published successfully and carries a remote id. */
export async function listPublishedTargets(): Promise<PublishedTarget[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("social_post_targets")
    .select("id, platform, remote_id")
    .eq("status", "published")
    .not("remote_id", "is", null);
  if (error) {
    log.error({ err: error.message }, "list_published_targets_failed");
    return [];
  }
  return (data as { id: string; platform: string; remote_id: string }[]).map((r) => ({
    id: r.id,
    platform: r.platform as SocialPlatform,
    remoteId: r.remote_id,
  }));
}
