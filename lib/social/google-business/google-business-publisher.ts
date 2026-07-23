import { scopedLogger } from "@/lib/logger";
import type {
  ComposedPost,
  PublishOutcome,
  PublishSupport,
  Publisher,
  SocialPlatform,
} from "@/lib/social/core";
import { PublishError } from "@/lib/social/core";
import {
  googleBusinessAccountId,
  googleBusinessLanguageCode,
  googleBusinessLocationId,
  googleBusinessProfileConfigured,
  googleBusinessRequest,
} from "./client";

const log = scopedLogger("social-google-business");
const MAX_SUMMARY_LENGTH = 1_500;

interface LocalPostResponse {
  name?: string;
  searchUrl?: string;
}

export class GoogleBusinessProfilePublisher implements Publisher {
  readonly platform: SocialPlatform = "google_business_profile";

  isConfigured(): boolean {
    return googleBusinessProfileConfigured();
  }

  supports(post: ComposedPost): PublishSupport {
    if (!post.caption.trim()) {
      return { ok: false, reason: "Google Business Profile requiere un texto para el post." };
    }
    if (post.caption.length > MAX_SUMMARY_LENGTH) {
      return {
        ok: false,
        reason: `Google Business Profile admite un máximo de ${MAX_SUMMARY_LENGTH} caracteres.`,
      };
    }
    if (post.media.some((media) => media.type === "video")) {
      return { ok: false, reason: "Google Business Profile no admite vídeos en Local Posts." };
    }
    return { ok: true };
  }

  async publish(post: ComposedPost): Promise<PublishOutcome> {
    const path = `accounts/${googleBusinessAccountId()}/locations/${googleBusinessLocationId()}/localPosts`;
    const created = await googleBusinessRequest<LocalPostResponse>(path, {
      method: "POST",
      body: JSON.stringify({
        languageCode: googleBusinessLanguageCode(),
        summary: post.caption,
        topicType: "STANDARD",
        media: post.media.map((media) => ({
          mediaFormat: "PHOTO",
          sourceUrl: media.publicUrl,
        })),
      }),
    });
    if (!created.name) {
      throw new PublishError(
        "google_business_profile",
        "Google no devolvió el identificador del Local Post.",
      );
    }
    log.info({ postId: post.id, remoteId: created.name }, "Published to Google Business Profile");
    return { remoteId: created.name, remoteUrl: created.searchUrl ?? null };
  }

  async deletePost(remoteId: string): Promise<void> {
    const path = remoteId.startsWith("accounts/")
      ? remoteId
      : `accounts/${googleBusinessAccountId()}/locations/${googleBusinessLocationId()}/localPosts/${remoteId}`;
    await googleBusinessRequest(path, { method: "DELETE" });
  }
}
