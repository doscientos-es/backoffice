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

const log = scopedLogger("social-repo-posts");

interface TargetRow {
  id: string;
  platform: string;
  status: string;
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

function mapTarget(row: TargetRow): TargetView {
  return {
    id: row.id,
    platform: row.platform as SocialPlatform,
    status: row.status as TargetStatus,
    remoteId: row.remote_id,
    remoteUrl: row.remote_url,
    error: row.error,
    publishedAt: row.published_at,
  };
}

function mapPost(row: PostRow): PostListItem {
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
  };
}

const POST_SELECT =
  "id, caption, media_kind, media, status, scheduled_at, published_at, created_at, " +
  "social_post_targets(id, platform, status, remote_id, remote_url, error, published_at)";

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
  const targets = input.platforms.map((platform) => ({ post_id: postId, platform }));
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
  return (data as unknown as PostRow[]).map(mapPost);
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

/** A published target with a remote id, ready for insight/comment sync. */
export interface PublishedTarget {
  id: string;
  platform: SocialPlatform;
  remoteId: string;
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
