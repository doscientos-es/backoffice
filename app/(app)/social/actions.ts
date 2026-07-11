"use server";

import { defineAction } from "@/lib/actions/define-action";
import { CreatePostSchema, PostIdInput, ReplyCommentInput } from "@/lib/schemas/social";
import type { SocialPlatform } from "@/lib/social/core";
import * as repo from "@/lib/social/repo";
import * as service from "@/lib/social/service";

/**
 * Social Hub server actions — thin transport layer.
 *
 * Every action delegates to the application service (lib/social/service), which
 * owns the orchestration. Actions only handle auth (via defineAction roles),
 * validation (Zod schemas) and cache revalidation. Media bytes are uploaded
 * out-of-band through /api/social/upload; these actions receive public URLs.
 */

const WRITE_ROLES = ["owner", "admin", "member"] as const;

/**
 * Create a composed post and, when `mode === "now"`, publish it immediately.
 * Returns the new post id so the client can navigate to its detail view.
 */
export const createPost = defineAction({
  name: "social.create",
  schema: CreatePostSchema,
  roles: [...WRITE_ROLES],
  revalidate: () => ["/social", "/social/dashboard"],
  handler: async (input, { user }) => {
    const postId = await repo.createPost({
      caption: input.caption,
      captions: input.captions as Partial<Record<SocialPlatform, string>> | undefined,
      media: input.media.map((m) => ({ ...m })),
      platforms: input.platforms as SocialPlatform[],
      scheduledAt: input.scheduledAt,
      createdBy: user.id,
    });
    if (input.mode === "now") await service.publishPost(postId);
    return { id: postId };
  },
});

/** Publish (or retry) an existing draft/scheduled post. */
export const publishPost = defineAction({
  name: "social.publish",
  schema: PostIdInput,
  roles: [...WRITE_ROLES],
  revalidate: () => ["/social", "/social/dashboard"],
  handler: async (input) => {
    const result = await service.publishPost(input.postId);
    return {
      status: result.status as string,
      /** Per-network results so the client can show inline error toasts. */
      targets: result.targets.map((t) => ({
        platform: t.platform as string,
        ok: t.ok,
        error: t.ok ? null : (t.error ?? "Error desconocido"),
      })),
    };
  },
});

/** Refresh insights for every published target that supports analytics. */
export const syncInsights = defineAction({
  name: "social.sync-insights",
  roles: [...WRITE_ROLES],
  revalidate: () => ["/social", "/social/dashboard"],
  handler: async () => {
    const { synced } = await service.syncInsights();
    return { synced };
  },
});

/** Refresh the unified comment inbox from every published target. */
export const syncComments = defineAction({
  name: "social.sync-comments",
  roles: [...WRITE_ROLES],
  revalidate: () => ["/social/feed"],
  handler: async () => {
    const { synced } = await service.syncComments();
    return { synced };
  },
});

/** Delete a post from every social network, then soft-delete locally. */
export const deletePost = defineAction({
  name: "social.delete",
  schema: PostIdInput,
  roles: [...WRITE_ROLES],
  revalidate: () => ["/social", "/social/feed"],
  handler: async (input) => {
    // Best-effort remote deletion — failures are logged but never block the local soft-delete.
    await service.deletePostFromNetworks(input.postId);
    await repo.deletePost(input.postId);
  },
});

/**
 * Soft-delete locally + remove media from Supabase storage.
 * Does NOT touch the live posts on any social network.
 */
export const deletePostLocal = defineAction({
  name: "social.delete_local",
  schema: PostIdInput,
  roles: [...WRITE_ROLES],
  revalidate: () => ["/social", "/social/feed"],
  handler: async (input) => {
    await service.deletePostLocalWithMedia(input.postId);
  },
});

/** Restore a soft-deleted post (clears deleted_at). */
export const restorePost = defineAction({
  name: "social.restore",
  schema: PostIdInput,
  roles: [...WRITE_ROLES],
  revalidate: () => ["/social", "/social/feed"],
  handler: async (input) => {
    await repo.restorePost(input.postId);
  },
});

/** Reply to a comment in the unified inbox as the connected organization. */
export const replyToComment = defineAction({
  name: "social.reply",
  schema: ReplyCommentInput,
  roles: [...WRITE_ROLES],
  revalidate: () => ["/social/feed"],
  handler: async (input) => {
    await service.replyToComment(input.commentId, input.message);
  },
});
