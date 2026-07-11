/**
 * Social Hub — LinkedIn Publisher (adapter).
 *
 * Implements the core Publisher port for the company Page by composing
 * linkedin-api.ts. LinkedIn accepts text-only posts, single image/video, and
 * multi-image carousels (2–20 images, no video). Insights are intentionally
 * omitted until the `rw_organization_admin` scope is approved — the optional
 * Publisher members let us ship publishing + comments first.
 */
import { scopedLogger } from "@/lib/logger";
import type {
  ComposedPost,
  PlatformComment,
  PublishOutcome,
  PublishSupport,
  Publisher,
  SocialPlatform,
} from "@/lib/social/core";
import { PublishError } from "@/lib/social/core";
import { linkedinToken, organizationId } from "./client";
import {
  createMediaPost,
  createMultiImagePost,
  createTextPost,
  getPostComments,
  deletePost as liDeletePost,
  permalinkFor,
  replyToComment,
  uploadImage,
  uploadVideo,
} from "./linkedin-api";

const log = scopedLogger("social-linkedin");

const MAX_CAROUSEL = 20;
const MIN_CAROUSEL = 2;

export class LinkedInPublisher implements Publisher {
  readonly platform: SocialPlatform = "linkedin";

  isConfigured(): boolean {
    return Boolean(linkedinToken() && organizationId());
  }

  supports(post: ComposedPost): PublishSupport {
    if (post.mediaKind === "carousel") {
      if (post.media.some((m) => m.type === "video")) {
        return { ok: false, reason: "LinkedIn no admite carruseles con vídeo." };
      }
      if (post.media.length < MIN_CAROUSEL || post.media.length > MAX_CAROUSEL) {
        return {
          ok: false,
          reason: `El carrusel admite entre ${MIN_CAROUSEL} y ${MAX_CAROUSEL} imágenes.`,
        };
      }
    }
    return { ok: true };
  }

  async publish(post: ComposedPost): Promise<PublishOutcome> {
    const shareUrn = await this.publishByKind(post);
    log.info({ postId: post.id, shareUrn }, "Published to LinkedIn");
    return { remoteId: shareUrn, remoteUrl: permalinkFor(shareUrn) };
  }

  private async publishByKind(post: ComposedPost): Promise<string> {
    switch (post.mediaKind) {
      case "text":
        return createTextPost(post.caption);
      case "photo": {
        const item = post.media[0];
        if (!item) throw new PublishError("linkedin", "Falta la imagen.");
        const urn = await uploadImage(item);
        return createMediaPost(post.caption, urn, "");
      }
      case "video": {
        const item = post.media[0];
        if (!item) throw new PublishError("linkedin", "Falta el vídeo.");
        const urn = await uploadVideo(item);
        return createMediaPost(post.caption, urn, "");
      }
      case "carousel": {
        const urns = await Promise.all(post.media.map((m) => uploadImage(m)));
        return createMultiImagePost(post.caption, urns);
      }
      default:
        throw new PublishError("linkedin", "Tipo de contenido no soportado en LinkedIn.");
    }
  }

  fetchComments(remoteId: string): Promise<PlatformComment[]> {
    return getPostComments(remoteId);
  }

  replyToComment(remoteCommentId: string, message: string): Promise<void> {
    return replyToComment(remoteCommentId, message);
  }

  deletePost(remoteId: string): Promise<void> {
    return liDeletePost(remoteId);
  }
}
