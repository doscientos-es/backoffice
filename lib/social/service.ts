/**
 * Social Hub — application service.
 *
 * Orchestrates the domain (registry + fan-out) with infrastructure (repository)
 * behind a small use-case API that server actions call. This is the only place
 * that knows how publishing, insight sync, comment sync and replies compose;
 * actions stay thin and the domain stays pure.
 */
import { scopedLogger } from "@/lib/logger";
import {
  canFetchComments,
  canFetchInsights,
  canReply,
  composePost,
  fanOutPublish,
} from "@/lib/social/core";
import type { CaptionByPlatform, FanOutResult, SocialPlatform } from "@/lib/social/core";
import { socialRegistry } from "@/lib/social/registry";
import * as repo from "@/lib/social/repo";
import type { PostDetail, TargetWithInsights } from "@/lib/social/types";

const log = scopedLogger("social-service");

/** Networks with a registered adapter that is configured (safe to target). */
export function availablePlatforms(): SocialPlatform[] {
  return socialRegistry().available();
}

/**
 * Publish an existing draft/scheduled post to every target it declares. Marks
 * the post `publishing`, fans out, then persists the per-target outcome.
 */
export async function publishPost(postId: string): Promise<FanOutResult> {
  const post = await repo.getPost(postId);
  if (!post) throw new Error("El post no existe.");
  const platforms = post.targets.map((t) => t.platform);
  if (platforms.length === 0) throw new Error("El post no tiene ninguna red seleccionada.");

  await repo.markPublishing(postId);
  const composed = composePost(post.id, post.caption, post.media);
  const captions = captionOverrides(post.targets);
  const result = await fanOutPublish(composed, platforms, socialRegistry(), captions);
  await repo.applyFanOut(postId, result);
  return result;
}

/** Collect the per-network copy overrides stored on the post's targets. */
function captionOverrides(targets: { platform: SocialPlatform; caption: string | null }[]) {
  const captions: CaptionByPlatform = {};
  for (const t of targets) {
    if (t.caption !== null) captions[t.platform] = t.caption;
  }
  return captions;
}

/** Fetch a post with its per-target insights merged in for the analytics view. */
export async function getPostDetail(postId: string): Promise<PostDetail | null> {
  const post = await repo.getPost(postId);
  if (!post) return null;
  const insightsByTarget = await repo.getInsightsByTarget(post.targets.map((t) => t.id));
  const targets: TargetWithInsights[] = post.targets.map((t) => ({
    ...t,
    insights: insightsByTarget.get(t.id) ?? null,
  }));
  return { ...post, targets };
}

/**
 * Refresh insights for every published target whose Publisher supports it.
 * Errors on one target are logged and skipped so the sweep always completes.
 */
export async function syncInsights(): Promise<{ synced: number }> {
  const registry = socialRegistry();
  const targets = await repo.listPublishedTargets();
  let synced = 0;
  for (const target of targets) {
    if (!registry.isAvailable(target.platform)) continue;
    const publisher = registry.get(target.platform);
    if (!canFetchInsights(publisher)) continue;
    try {
      const insights = await publisher.fetchInsights(target.remoteId);
      await repo.upsertInsights(target.id, insights);
      synced += 1;
    } catch (err) {
      log.warn({ target: target.id, err: String(err) }, "sync_insights_target_failed");
    }
  }
  return { synced };
}

/**
 * Refresh comments for every published target whose Publisher supports it.
 * Same isolation guarantee as {@link syncInsights}.
 */
export async function syncComments(): Promise<{ synced: number }> {
  const registry = socialRegistry();
  const targets = await repo.listPublishedTargets();
  let synced = 0;
  for (const target of targets) {
    if (!registry.isAvailable(target.platform)) continue;
    const publisher = registry.get(target.platform);
    if (!canFetchComments(publisher)) continue;
    try {
      const comments = await publisher.fetchComments(target.remoteId);
      await repo.upsertComments(target.id, target.platform, comments);
      synced += 1;
    } catch (err) {
      log.warn({ target: target.id, err: String(err) }, "sync_comments_target_failed");
    }
  }
  return { synced };
}

/** Reply to a comment via its Publisher, then flag it replied locally. */
export async function replyToComment(commentId: string, message: string): Promise<void> {
  const comment = await repo.getComment(commentId);
  if (!comment) throw new Error("El comentario no existe.");
  const publisher = socialRegistry().get(comment.platform);
  if (!canReply(publisher)) throw new Error("Esta red no permite responder comentarios.");
  await publisher.replyToComment(comment.remoteCommentId, message);
  await repo.markReplied(commentId);
}
